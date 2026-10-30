# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

import jsonschema
import pytest
import yaml
from django.core.management import CommandError, call_command
from django.db.models import Q
from django.test import RequestFactory, override_settings
from django.urls import path
from drf_spectacular.generators import SchemaGenerator
from drf_spectacular.settings import patched_settings
from drf_spectacular.utils import extend_schema
from drf_spectacular.validation import validate_schema
from rest_framework import serializers
from rest_framework.renderers import JSONRenderer
from rest_framework.request import Request
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet

from plane.app.serializers import IssueRelationSerializer, NotificationSerializer
from plane.db.management.commands.generate_openapi import generate_schema
from plane.db.models import Issue, IssueRelation, Notification, Project, State, User, Workspace
from plane.tests.factories import ProjectFactory, WorkspaceFactory
from plane.tests.openapi import strict
from plane.utils.openapi.pagination import FLAT, GROUPED, SUB_GROUPED, paginated_response, paginated_union
from plane.utils.openapi.hooks import is_callable
from plane.utils.openapi.schema import ALWAYS, MAYBE_NULL, OMITTED, DetailOrList, _source_presence, single
from plane.utils.openapi.fields import ClientJsonField, typed_json
from plane.utils.openapi.serializers import DictOf, EmptyObjectSerializer
from plane.utils.openapi.surfaces import SURFACES
from plane.utils.paginator import BasePaginator, GroupedOffsetPaginator, SubGroupedOffsetPaginator
from plane.utils.issue_type import link_starter_type


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

    @override_settings(SESSION_COOKIE_NAME="foo")
    def test_ignores_the_deployment_session_cookie_name(self):
        schema, _ = generate_schema("internal")
        schemes = schema["components"]["securitySchemes"]
        assert schemes["cookieAuth"]["name"] == schemes["sessionAuth"]["name"] == "session-id"

    def test_rejects_unknown_surface(self, tmp_path):
        with pytest.raises(CommandError, match="Unknown surface: nope"):
            call_command("generate_openapi", "nope", output_dir=tmp_path)


class PageItemSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    priority = serializers.CharField()
    state_id = serializers.UUIDField()


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
    return strict({**response, "components": schema["components"]})


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
            Issue.objects.create(
                name=name,
                priority=priority,
                project=project,
                workspace=project.workspace,
                type=link_starter_type(project),
            )
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
        for other in (FLAT, SUB_GROUPED):
            with pytest.raises(jsonschema.ValidationError):
                jsonschema.validate(data, _response_schema(other))


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

    def test_optional_property_is_nullable(self):
        assert _source_presence(User, "avatar_url") == MAYBE_NULL
        assert _source_presence(Workspace, "logo_url") == MAYBE_NULL
        assert _source_presence(Project, "cover_image_url") == MAYBE_NULL
        assert _source_presence(User, "full_name") == ALWAYS


class ItemView(APIView):
    def get(self, request, pk=None):
        pass

    def patch(self, request, pk):
        pass

    def post(self, request):
        pass


class ItemViewSet(ViewSet):
    def update_item(self, request, *args, **kwargs):
        pass


@pytest.mark.unit
class TestIsCallable:
    def test_apiview_routed_twice(self):
        view = ItemView.as_view()
        assert is_callable("/items/", "GET", view)
        assert is_callable("/items/{pk}/", "GET", view)
        assert not is_callable("/items/", "PATCH", view)
        assert is_callable("/items/{pk}/", "PATCH", view)
        assert is_callable("/items/", "POST", view)
        assert not is_callable("/items/{pk}/", "POST", view)

    def test_kwargs_handler_takes_any_path(self):
        view = ItemViewSet.as_view({"patch": "update_item"})
        assert is_callable("/items/{pk}/", "PATCH", view)


def _schema(*patterns):
    with patched_settings({"PREPROCESSING_HOOKS": []}):
        return SchemaGenerator(patterns=list(patterns)).get_schema(request=None, public=True)


def _body(schema, path, method="get", code="200"):
    return schema["paths"][path][method]["responses"][code]["content"]["application/json"]["schema"]


@pytest.mark.unit
class TestResponseHelpers:
    def test_detail_or_list(self):
        class View(APIView):
            @extend_schema(responses={200: DetailOrList(PageItemSerializer)})
            def get(self, request, pk=None):
                pass

        schema = _schema(path("items/", View.as_view()), path("items/<uuid:pk>/", View.as_view()))
        assert _body(schema, "/items/") == {"type": "array", "items": {"$ref": "#/components/schemas/PageItem"}}
        assert _body(schema, "/items/{pk}/") == {"$ref": "#/components/schemas/PageItem"}

    def test_empty_object(self):
        class View(APIView):
            @extend_schema(responses={200: EmptyObjectSerializer})
            def get(self, request):
                pass

        schema = _schema(path("items/", View.as_view()))
        assert _body(schema, "/items/") == {"$ref": "#/components/schemas/EmptyObject"}
        assert schema["components"]["schemas"]["EmptyObject"] == {"type": "object", "additionalProperties": False}

    def test_list_action_keeps_single_and_paginated_bodies(self):
        class Items(ViewSet):
            @extend_schema(responses={200: single(PageItemSerializer)})
            def list(self, request):
                pass

        class Pages(ViewSet):
            @extend_schema(responses={200: paginated_response(PageItemSerializer)})
            def list(self, request):
                pass

        schema = _schema(path("items/", Items.as_view({"get": "list"})), path("pages/", Pages.as_view({"get": "list"})))
        assert _body(schema, "/items/") == {"$ref": "#/components/schemas/PageItem"}
        assert _body(schema, "/pages/") == {"$ref": "#/components/schemas/PaginatedPageItemList"}

    def test_paginated_union_and_bare_field(self):
        class View(APIView):
            @extend_schema(responses={200: paginated_union(PageItemSerializer)})
            def get(self, request):
                pass

            @extend_schema(responses={200: serializers.DictField(child=serializers.IntegerField())})
            def post(self, request):
                pass

        schema = _schema(path("items/", View.as_view()))
        union = schema["components"]["schemas"]["PageItemListResponse"]["oneOf"]
        assert [ref["$ref"].rsplit("/", 1)[1] for ref in union] == [
            "PaginatedPageItemList",
            "GroupedPaginatedPageItemList",
            "SubGroupedPaginatedPageItemList",
        ]
        assert _body(schema, "/items/", "post") == {"type": "object", "additionalProperties": {"type": "integer"}}

    def test_meta_presence_overrides(self):
        class Annotated(serializers.Serializer):
            always = serializers.IntegerField(read_only=True)
            sometimes = serializers.IntegerField(allow_null=True)
            annotated = serializers.IntegerField(read_only=True)

            class Meta:
                response_required = ("always",)
                response_optional = ("sometimes",)
                response_nullable = ("annotated",)

        class View(APIView):
            @extend_schema(responses={200: Annotated})
            def get(self, request):
                pass

        component = _schema(path("items/", View.as_view()))["components"]["schemas"]["Annotated"]
        assert component["required"] == ["always"]
        assert component["properties"]["sometimes"]["nullable"] is True
        assert component["properties"]["annotated"]["nullable"] is True

    def test_dict_of(self):
        class PageItemMapSerializer(DictOf):
            child = PageItemSerializer

        class View(APIView):
            @extend_schema(responses={200: PageItemMapSerializer})
            def get(self, request):
                pass

        schema = _schema(path("items/", View.as_view()))
        assert schema["components"]["schemas"]["PageItemMap"] == {
            "type": "object",
            "additionalProperties": {"$ref": "#/components/schemas/PageItem"},
        }

    def test_typed_json(self):
        class HolderSerializer(serializers.Serializer):
            value = typed_json(PageItemSerializer)(allow_null=True, required=False)

        assert HolderSerializer(data={"value": {"any": 1}}).is_valid()

        class View(APIView):
            @extend_schema(responses={200: HolderSerializer})
            def get(self, request):
                pass

        value = _schema(path("items/", View.as_view()))["components"]["schemas"]["Holder"]["properties"]["value"]
        assert value == {"allOf": [{"$ref": "#/components/schemas/PageItem"}], "nullable": True}


@pytest.mark.unit
class TestClientJson:
    def test_named_json_columns_are_client_json(self):
        class HolderSerializer(serializers.Serializer):
            view_props = serializers.JSONField()
            maybe = ClientJsonField(allow_null=True)
            metadata = serializers.JSONField()
            shaped = typed_json(PageItemSerializer)()

        class View(APIView):
            @extend_schema(request=HolderSerializer, responses={200: HolderSerializer})
            def post(self, request):
                pass

        schema = _schema(path("items/", View.as_view()))
        components = schema["components"]["schemas"]
        for name in ("Holder", "HolderRequest"):
            props = components[name]["properties"]
            assert props["view_props"] == {"$ref": "#/components/schemas/ClientJson"}
            assert props["maybe"] == {"allOf": [{"$ref": "#/components/schemas/ClientJson"}], "nullable": True}
            assert props["metadata"] == {}
            assert props["shaped"]["$ref"].startswith("#/components/schemas/PageItem")
        assert components["ClientJson"]["x-client-owned"] is True
        assert components["ClientJson"]["additionalProperties"] is True


@pytest.mark.unit
class TestRequestBodies:
    def _request(self, serializer):
        class View(APIView):
            @extend_schema(request=serializer, responses={204: None})
            def patch(self, request):
                pass

        schema = _schema(path("items/", View.as_view()))
        ref = schema["paths"]["/items/"]["patch"]["requestBody"]["content"]["application/json"]["schema"]["$ref"]
        return ref.rsplit("/", 1)[1], schema

    def test_patch_is_partial(self):
        name, schema = self._request(PageItemSerializer)
        assert name == "PatchedPageItemRequest"
        assert "required" not in schema["components"]["schemas"][name]

    def test_partial_on_patch_false_keeps_required(self):
        class RoleSerializer(serializers.Serializer):
            partial_on_patch = False
            role = serializers.IntegerField()

        name, schema = self._request(RoleSerializer)
        assert name == "RoleRequest"
        assert schema["components"]["schemas"][name]["required"] == ["role"]
