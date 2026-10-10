# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""A work item without a type has its project's default type wherever work
items are filtered, counted or grouped by type."""

import datetime

import pytest
from django.utils import timezone
from rest_framework import status

from plane.automation.context import AutomationContext
from plane.automation.query import prefilter
from plane.db.models import (
    Issue,
    IssueProperty,
    IssuePropertyValue,
    IssueType,
    Project,
    ProjectIssueType,
    ProjectMember,
)
from plane.utils.derived_properties import refresh_derived_values
from plane.utils.filters.filterset import IssueFilterSet


@pytest.fixture
def types(db, workspace):
    return {
        "Task": IssueType.objects.create(workspace=workspace, name="Task", is_default=True),
        "Invoice": IssueType.objects.create(workspace=workspace, name="Invoice"),
    }


def make_project(workspace, user, name, identifier, links):
    project = Project.objects.create(name=name, identifier=identifier, workspace=workspace, created_by=user)
    ProjectMember.objects.create(project=project, member=user, role=20, is_active=True)
    for issue_type in links:
        ProjectIssueType.objects.create(project=project, issue_type=issue_type, workspace=workspace)
    return project


@pytest.fixture
def sales(workspace, create_user, types):
    """Defaults to Task."""
    return make_project(workspace, create_user, "Sales", "SAL", [types["Task"], types["Invoice"]])


@pytest.fixture
def ops(workspace, create_user, types):
    """Has no default: its link to Task is soft-deleted."""
    project = make_project(workspace, create_user, "Ops", "OPS", [types["Task"], types["Invoice"]])
    ProjectIssueType.objects.filter(project=project, issue_type=types["Task"]).update(deleted_at=timezone.now())
    return project


@pytest.fixture
def items(workspace, sales, ops, types):
    return {
        "Invoice": Issue.objects.create(name="Invoice", workspace=workspace, project=sales, type=types["Invoice"]),
        "Untyped sales": Issue.objects.create(name="Untyped sales", workspace=workspace, project=sales),
        "Untyped ops": Issue.objects.create(name="Untyped ops", workspace=workspace, project=ops),
    }


def names(queryset):
    return set(queryset.values_list("name", flat=True))


@pytest.mark.contract
@pytest.mark.django_db
class TestRichFilter:
    def filtered(self, workspace, data):
        filterset = IssueFilterSet(data=data, queryset=Issue.objects.filter(workspace=workspace))
        assert filterset.is_valid(), filterset.errors
        return names(filterset.qs)

    def test_untyped_items_match_their_project_default(self, workspace, types, items):
        assert self.filtered(workspace, {"issue_type_id": str(types["Task"].id)}) == {"Untyped sales"}
        assert self.filtered(workspace, {"issue_type_id": str(types["Invoice"].id)}) == {"Invoice"}
        both = f"{types['Task'].id},{types['Invoice'].id}"
        assert self.filtered(workspace, {"issue_type_id__in": both}) == {"Invoice", "Untyped sales"}


@pytest.mark.contract
@pytest.mark.django_db
class TestWorkspaceCount:
    def url(self, workspace):
        return f"/api/v1/workspaces/{workspace.slug}/work-items/count/"

    def test_untyped_items_count_in_their_default_type_group(self, api_key_client, workspace, types, items):
        response = api_key_client.get(self.url(workspace), {"group_by": "type_id"})

        assert response.status_code == status.HTTP_200_OK
        assert response.data["grouped_counts"] == {
            str(types["Task"].id): {"count": 1},
            str(types["Invoice"].id): {"count": 1},
            "None": {"count": 1},
        }

    def test_sub_group_by_type(self, api_key_client, workspace, sales, types, items):
        response = api_key_client.get(self.url(workspace), {"group_by": "project_id", "sub_group_by": "type_id"})

        assert response.status_code == status.HTTP_200_OK
        assert response.data["grouped_counts"][str(sales.id)]["sub_grouped_counts"] == {
            str(types["Task"].id): {"count": 1},
            str(types["Invoice"].id): {"count": 1},
        }


@pytest.mark.contract
@pytest.mark.django_db
class TestDashboardWidget:
    def preview(self, client, workspace, **definition):
        response = client.post(f"/api/workspaces/{workspace.slug}/dashboards/preview/", definition, format="json")
        assert response.status_code == status.HTTP_200_OK, response.data
        return {row["name"]: row["count"] for row in response.data["data"]}

    def test_type_dimension_puts_untyped_items_in_the_default_type(self, session_client, workspace, items):
        rows = self.preview(session_client, workspace, chart_type="bar", dimension={"field": "type"})
        assert rows == {"Task": 1, "Invoice": 1, "None": 1}

    def test_an_untyped_ancestor_has_the_default_type(self, session_client, workspace, sales, types, items):
        parent = items["Untyped sales"]
        items["Invoice"].parent = parent
        items["Invoice"].save()

        rows = self.preview(
            session_client,
            workspace,
            chart_type="bar",
            query='type = "Invoice"',
            dimension={"field": f"ancestor:{types['Task'].id}"},
        )
        assert rows == {f"SAL-{parent.sequence_id} Untyped sales": 1}


@pytest.mark.contract
@pytest.mark.django_db
class TestAutomation:
    def test_prefilter_matches_untyped_items_of_the_type(self, workspace, types, items):
        condition = {"type": "condition", "property": "type_id", "operator": "in", "value": [str(types["Task"].id)]}
        q = prefilter(condition, datetime.date.today())
        assert names(Issue.objects.filter(workspace=workspace).filter(q)) == {"Untyped sales"}

    def test_context_resolves_the_default_type(self, types, items):
        assert AutomationContext(work_item=items["Untyped sales"]).get("type_id") == types["Task"].id
        assert AutomationContext(work_item=items["Untyped ops"]).get("type_id") is None
        assert AutomationContext(work_item=items["Invoice"]).get("type_id") == types["Invoice"].id


@pytest.mark.contract
@pytest.mark.django_db
class TestDerivedLookup:
    def test_an_untyped_ancestor_is_found_as_the_default_type(self, workspace, sales, types, items):
        parent = items["Untyped sales"]
        items["Invoice"].parent = parent
        items["Invoice"].save()
        task = IssueProperty.objects.create(
            workspace=workspace,
            project=sales,
            name="Task",
            display_name="Task",
            property_type="RELATION",
            relation_type="ISSUE",
            derivation="LOOKUP",
            derivation_config={"issue_type": str(types["Task"].id), "source": "item", "include_self": True},
        )

        refresh_derived_values(sales.id)

        found = dict(IssuePropertyValue.objects.filter(property=task).values_list("issue__name", "value_issue_id"))
        assert found == {"Untyped sales": parent.id, "Invoice": parent.id}
