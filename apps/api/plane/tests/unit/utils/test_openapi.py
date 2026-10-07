# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

import jsonschema
import pytest
import yaml
from django.core.management import CommandError, call_command
from django.db.models import Q
from django.test import RequestFactory
from django.urls import path
from drf_spectacular.generators import SchemaGenerator
from drf_spectacular.settings import patched_settings
from drf_spectacular.utils import extend_schema
from drf_spectacular.validation import validate_schema
from rest_framework import serializers
from rest_framework.renderers import JSONRenderer
from rest_framework.request import Request
from rest_framework.views import APIView

from plane.app.serializers import IssueRelationSerializer, NotificationSerializer
from plane.db.models import Issue, IssueRelation, Notification, State, User
from plane.tests.factories import ProjectFactory, WorkspaceFactory
from plane.utils.openapi.pagination import FLAT, GROUPED, SUB_GROUPED, paginated_response
from plane.utils.openapi.schema import ALWAYS, MAYBE_NULL, OMITTED, _source_presence
from plane.utils.openapi.surfaces import SURFACES
from plane.utils.paginator import BasePaginator, GroupedOffsetPaginator, SubGroupedOffsetPaginator


@pytest.mark.unit
class TestGenerateOpenapi:
    # No django_db mark: any database access fails the test.
    def test_writes_valid_deterministic_schemas(self, tmp_path):
        call_command("generate_openapi", output_dir=tmp_path / "a")
        call_command("generate_openapi", output_dir=tmp_path / "b")

        prefixes = {}
        for surface in SURFACES:
            content = (tmp_path / "a" / f"{surface}.yaml").read_bytes()
            assert content == (tmp_path / "b" / f"{surface}.yaml").read_bytes()
            schema = yaml.safe_load(content)
            validate_schema(schema)
            assert schema["paths"]
            prefixes[surface] = {p.split("/")[2] for p in schema["paths"] if p.startswith("/api/")}

        assert prefixes["v1"] == {"v1"}
        assert prefixes["admin"] == {"instances"}
        assert not prefixes["internal"] & {"v1", "instances"}
        assert "public" in prefixes["internal"]

        components = yaml.safe_load((tmp_path / "a" / "internal.yaml").read_bytes())["components"]["schemas"]
        # Response fields DRF always emits are required; "order" is only set by the list endpoints.
        assert {"id", "name", "default"} <= set(components["ProjectState"]["required"])
        assert "order" not in components["ProjectState"]["required"]
        assert "order" in components["OrderedState"]["required"]
        assert "id" not in components["StateRequest"].get("properties", {})

    def test_rejects_unknown_surface(self, tmp_path):
        with pytest.raises(CommandError, match="Unknown surface: nope"):
            call_command("generate_openapi", "nope", output_dir=tmp_path)


class PageItemSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    priority = serializers.CharField()
    state_id = serializers.UUIDField()


def _strict(node):
    """Turn an OpenAPI 3.0 schema into a JSON schema that rejects unknown keys."""
    if isinstance(node, list):
        return [_strict(item) for item in node]
    if not isinstance(node, dict):
        return node
    node = {key: _strict(value) for key, value in node.items()}
    if "properties" in node:
        node["additionalProperties"] = False
    if node.pop("nullable", False):
        if "type" in node:
            node["type"] = [node["type"], "null"]
        else:
            node = {"anyOf": [node, {"type": "null"}]}
    return node


def _response_schema(grouping):
    class View(APIView):
        @extend_schema(responses=paginated_response(PageItemSerializer, grouping))
        def get(self, request):
            pass

    with patched_settings({"PREPROCESSING_HOOKS": []}):
        schema = SchemaGenerator(patterns=[path("items/", View.as_view())]).get_schema(request=None, public=True)
    response = schema["paths"]["/items/"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]
    for component in schema["components"]["schemas"].values():
        assert set(component.get("required", [])) == set(component["properties"])
    return _strict({**response, "components": schema["components"]})


def _paginate(**kwargs):
    request = Request(RequestFactory().get("/items/"))
    response = BasePaginator().paginate(
        request=request,
        order_by="-created_at",
        on_results=lambda issues: list(issues.values("id", "name", "priority", "state_id")),
        count_filter=Q(archived_at__isnull=True),
        **kwargs,
    )
    return json.loads(JSONRenderer().render(response.data))


@pytest.mark.unit
@pytest.mark.django_db
class TestPaginatedResponse:
    @pytest.fixture
    def issues(self):
        project = ProjectFactory(workspace=WorkspaceFactory())
        State.objects.create(name="Todo", group="unstarted", default=True, project=project, workspace=project.workspace)
        for name, priority in [("a", "high"), ("b", "high"), ("c", "low")]:
            Issue.objects.create(name=name, priority=priority, project=project, workspace=project.workspace)
        return Issue.issue_objects.filter(project=project)

    def test_flat(self, issues):
        data = _paginate(queryset=issues)
        assert len(data["results"]) == 3
        jsonschema.validate(data, _response_schema(FLAT))

    def test_grouped(self, issues):
        data = _paginate(
            queryset=issues,
            paginator_cls=GroupedOffsetPaginator,
            group_by_field_name="priority",
            group_by_fields=["high", "low", "none"],
        )
        assert len(data["results"]["high"]["results"]) == 2
        jsonschema.validate(data, _response_schema(GROUPED))

    def test_sub_grouped(self, issues):
        state_ids = [
            str(state_id)
            for state_id in State.objects.filter(project_id=issues[0].project_id).values_list("id", flat=True)
        ]
        data = _paginate(
            queryset=issues,
            paginator_cls=SubGroupedOffsetPaginator,
            group_by_field_name="priority",
            group_by_fields=["high", "low"],
            sub_group_by_field_name="state_id",
            sub_group_by_fields=state_ids,
        )
        state_id = str(issues[0].state_id)
        assert len(data["results"]["high"]["results"][state_id]["results"]) == 2
        jsonschema.validate(data, _response_schema(SUB_GROUPED))

    def test_empty_grouped_results_are_an_object(self, issues):
        data = _paginate(
            queryset=issues.none(),
            paginator_cls=GroupedOffsetPaginator,
            group_by_field_name="priority",
            group_by_fields=["high"],
        )
        assert data["results"] == {}
        jsonschema.validate(data, _response_schema(GROUPED))


def _component(serializer_class):
    class View(APIView):
        @extend_schema(responses=serializer_class)
        def get(self, request):
            pass

    with patched_settings({"PREPROCESSING_HOOKS": []}):
        schema = SchemaGenerator(patterns=[path("items/", View.as_view())]).get_schema(request=None, public=True)
    response = schema["paths"]["/items/"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]
    return schema["components"]["schemas"][response["$ref"].split("/")[-1]]


@pytest.mark.unit
class TestSerializedPresence:
    def test_source_paths(self):
        assert _source_presence(Issue, "name") == ALWAYS
        assert _source_presence(Issue, "state") == MAYBE_NULL
        assert _source_presence(Issue, "project.name") == ALWAYS
        assert _source_presence(Issue, "state.name") == OMITTED
        assert _source_presence(User, "profile") == MAYBE_NULL
        assert _source_presence(User, "profile.theme") == MAYBE_NULL
        assert _source_presence(Issue, "assignees") == ALWAYS
        assert _source_presence(Issue, "nope") == OMITTED

    def test_null_foreign_key_is_required_and_nullable(self):
        schema = _component(NotificationSerializer)
        assert "triggered_by_details" in schema["required"]
        assert schema["properties"]["triggered_by_details"]["nullable"] is True

        data = NotificationSerializer(Notification(triggered_by=None)).data
        assert data["triggered_by_details"] is None

    def test_path_through_null_foreign_key_is_optional(self):
        schema = _component(IssueRelationSerializer)
        assert "state_id" not in schema["required"]
        assert "name" in schema["required"]

        data = IssueRelationSerializer(IssueRelation(related_issue=Issue(name="a", state=None))).data
        assert "state_id" not in data
        assert data["name"] == "a"
