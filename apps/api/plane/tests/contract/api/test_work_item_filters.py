# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for `pql` / `filters` on the work item endpoints.

Two properties matter here. Nothing outside the field allowlist may reach the
ORM, and no endpoint may return a work item from a project the caller is not a
member of, the workspace wide list and count included.
"""

import json

import pytest
from rest_framework import status

from plane.db.models import (
    Cycle,
    CycleIssue,
    Issue,
    IssueAssignee,
    IssueProperty,
    IssuePropertyValue,
    Module,
    ModuleIssue,
    Project,
    ProjectMember,
    PropertyTypeChoices,
    State,
    User,
    WorkspaceMember,
)


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(
        name="Filter Project",
        identifier="FLT",
        workspace=workspace,
        created_by=create_user,
    )
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def teammate(db, workspace, project):
    user = User.objects.create(email="teammate@example.test", username="teammate")
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
    ProjectMember.objects.create(project=project, member=user, role=15, is_active=True)
    return user


@pytest.fixture
def state(db, workspace, project):
    return State.objects.create(
        name="Todo",
        group="unstarted",
        project=project,
        workspace=workspace,
        default=True,
    )


@pytest.fixture
def done_state(db, workspace, project):
    return State.objects.create(name="Done", group="completed", project=project, workspace=workspace)


@pytest.fixture
def parent_item(db, workspace, project, state, create_user):
    issue = Issue.objects.create(
        name="Parent item",
        priority="urgent",
        workspace=workspace,
        project=project,
        state=state,
        created_by=create_user,
    )
    IssueAssignee.objects.create(issue=issue, assignee=create_user, project=project, workspace=workspace)
    return issue


@pytest.fixture
def child_item(db, workspace, project, state, create_user, parent_item):
    return Issue.objects.create(
        name="Child item",
        priority="low",
        parent=parent_item,
        workspace=workspace,
        project=project,
        state=state,
        created_by=create_user,
    )


@pytest.fixture
def teammate_item(db, workspace, project, done_state, create_user, teammate):
    issue = Issue.objects.create(
        name="Teammate item",
        priority="medium",
        workspace=workspace,
        project=project,
        state=done_state,
        created_by=create_user,
    )
    IssueAssignee.objects.create(issue=issue, assignee=teammate, project=project, workspace=workspace)
    return issue


@pytest.fixture
def work_items(parent_item, child_item, teammate_item):
    return [parent_item, child_item, teammate_item]


@pytest.fixture
def outsider(db):
    return User.objects.create(email="outsider@example.test", username="outsider")


@pytest.fixture
def hidden_item(db, workspace, outsider):
    """A work item in a project of the same workspace the caller cannot see."""
    hidden_project = Project.objects.create(
        name="Hidden Project",
        identifier="HID",
        workspace=workspace,
        created_by=outsider,
    )
    ProjectMember.objects.create(project=hidden_project, member=outsider, role=20, is_active=True)
    hidden_state = State.objects.create(
        name="Todo",
        group="unstarted",
        project=hidden_project,
        workspace=workspace,
        default=True,
    )
    return Issue.objects.create(
        name="Hidden item",
        priority="urgent",
        workspace=workspace,
        project=hidden_project,
        state=hidden_state,
        created_by=outsider,
    )


@pytest.fixture
def text_property(db, workspace, project, create_user):
    return IssueProperty.objects.create(
        name="region",
        display_name="Region",
        property_type=PropertyTypeChoices.TEXT,
        project=project,
        workspace=workspace,
        created_by=create_user,
    )


@pytest.fixture
def tagged_item(db, workspace, project, text_property, work_items, parent_item):
    """Exactly one of the three work items carries a custom property value."""
    IssuePropertyValue.objects.create(
        issue=parent_item,
        property=text_property,
        value_text="north",
        project=project,
        workspace=workspace,
    )
    return parent_item


@pytest.fixture
def cycle(db, workspace, project, create_user, work_items):
    cycle = Cycle.objects.create(name="Cycle 1", workspace=workspace, project=project, owned_by=create_user)
    for issue in work_items:
        CycleIssue.objects.create(cycle=cycle, issue=issue, workspace=workspace, project=project)
    return cycle


@pytest.fixture
def module(db, workspace, project, work_items):
    module = Module.objects.create(name="Module 1", workspace=workspace, project=project)
    for issue in work_items:
        ModuleIssue.objects.create(module=module, issue=issue, workspace=workspace, project=project)
    return module


def project_list_url(slug, project_id):
    return f"/api/v1/workspaces/{slug}/projects/{project_id}/work-items/"


def archived_list_url(slug, project_id):
    return f"/api/v1/workspaces/{slug}/projects/{project_id}/archived-work-items/"


def workspace_list_url(slug):
    return f"/api/v1/workspaces/{slug}/work-items/"


def workspace_count_url(slug):
    return f"/api/v1/workspaces/{slug}/work-items/count/"


def result_names(response):
    return {row["name"] for row in response.data["results"]}


@pytest.mark.contract
class TestFilterRejection:
    """A filter that names something outside the allowlist must 400, never
    reach `.filter()`. This is the same class of payload as the order_by
    injection fixed by GHSA-p885-6jpg-cr2p."""

    def urls(self, workspace, project, cycle, module):
        return [
            project_list_url(workspace.slug, project.id),
            archived_list_url(workspace.slug, project.id),
            f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/cycles/{cycle.id}/cycle-issues/",
            f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/modules/{module.id}/module-issues/",
            workspace_list_url(workspace.slug),
            workspace_count_url(workspace.slug),
        ]

    @pytest.mark.django_db
    def test_unknown_field_is_rejected(self, api_key_client, workspace, project, cycle, module):
        for url in self.urls(workspace, project, cycle, module):
            response = api_key_client.get(url, {"filters": json.dumps({"description_stripped": "x"})})
            assert response.status_code == status.HTTP_400_BAD_REQUEST, f"{url} got {response.status_code}"

    @pytest.mark.django_db
    def test_relation_traversal_is_rejected(self, api_key_client, workspace, project, cycle, module):
        for url in self.urls(workspace, project, cycle, module):
            response = api_key_client.get(url, {"filters": json.dumps({"assignees__email": "someone@example.test"})})
            assert response.status_code == status.HTTP_400_BAD_REQUEST, f"{url} got {response.status_code}"

    @pytest.mark.django_db
    def test_pql_and_filters_together_are_rejected(self, api_key_client, workspace, project, cycle, module):
        params = {"pql": 'priority = "urgent"', "filters": json.dumps({"priority": "urgent"})}
        for url in self.urls(workspace, project, cycle, module):
            response = api_key_client.get(url, params)
            assert response.status_code == status.HTTP_400_BAD_REQUEST, f"{url} got {response.status_code}"

    @pytest.mark.django_db
    def test_malformed_pql_is_rejected(self, api_key_client, workspace, project, work_items):
        response = api_key_client.get(project_list_url(workspace.slug, project.id), {"pql": "priority ="})
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "line" in response.data


@pytest.mark.contract
class TestProjectScopedFiltering:
    @pytest.mark.django_db
    def test_filters_narrow_the_project_list(self, api_key_client, workspace, project, work_items):
        url = project_list_url(workspace.slug, project.id)
        response = api_key_client.get(url, {"filters": json.dumps({"priority": "urgent"})})

        assert response.status_code == status.HTTP_200_OK
        assert result_names(response) == {"Parent item"}
        assert response.data["total_count"] == 1

    @pytest.mark.django_db
    def test_pql_and_filters_agree(self, api_key_client, workspace, project, work_items):
        """The two front doors compile to the same AST, so they must return the
        same rows."""
        url = project_list_url(workspace.slug, project.id)
        expression = {"or": [{"priority": "urgent"}, {"state__group": "completed"}]}

        by_filters = api_key_client.get(url, {"filters": json.dumps(expression)})
        by_pql = api_key_client.get(url, {"pql": 'priority = "urgent" OR state_group = "completed"'})

        assert by_filters.status_code == status.HTTP_200_OK
        assert by_pql.status_code == status.HTTP_200_OK
        assert result_names(by_filters) == {"Parent item", "Teammate item"}
        assert result_names(by_pql) == result_names(by_filters)

    @pytest.mark.django_db
    def test_cycle_and_module_lists_filter(self, api_key_client, workspace, project, cycle, module):
        for url in (
            f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/cycles/{cycle.id}/cycle-issues/",
            f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/modules/{module.id}/module-issues/",
        ):
            response = api_key_client.get(url, {"pql": 'priority = "urgent"'})
            assert response.status_code == status.HTTP_200_OK, f"{url} got {response.status_code}"
            assert result_names(response) == {"Parent item"}

    @pytest.mark.django_db
    def test_archived_list_filters(self, api_key_client, workspace, project, work_items, parent_item):
        parent_item.archived_at = "2024-05-01"
        parent_item.save(update_fields=["archived_at"])
        url = archived_list_url(workspace.slug, project.id)

        response = api_key_client.get(url, {"filters": json.dumps({"priority": "urgent"})})
        assert response.status_code == status.HTTP_200_OK
        assert result_names(response) == {"Parent item"}

        response = api_key_client.get(url, {"filters": json.dumps({"priority": "low"})})
        assert result_names(response) == set()


@pytest.mark.contract
class TestCustomPropertyFilters:
    """Custom property leaves compile to an empty `Q` and are carried on
    `CompiledFilters.custom_properties`. An endpoint that applied only the `Q`
    would silently return every work item, so these assert a strict subset."""

    @pytest.mark.django_db
    def test_filters_on_a_custom_property_return_a_strict_subset(
        self, api_key_client, workspace, project, text_property, tagged_item, work_items
    ):
        url = project_list_url(workspace.slug, project.id)
        unfiltered = api_key_client.get(url)
        assert len(unfiltered.data["results"]) == 3

        response = api_key_client.get(url, {"filters": json.dumps({f"property__{text_property.id}": "north"})})

        assert response.status_code == status.HTTP_200_OK
        assert result_names(response) == {"Parent item"}
        assert response.data["total_count"] == 1

    @pytest.mark.django_db
    def test_pql_custom_property_returns_a_strict_subset(
        self, api_key_client, workspace, project, text_property, tagged_item, work_items
    ):
        url = project_list_url(workspace.slug, project.id)
        response = api_key_client.get(url, {"pql": f'cf["{text_property.id}"] = "north"'})

        assert response.status_code == status.HTTP_200_OK
        assert result_names(response) == {"Parent item"}

    @pytest.mark.django_db
    def test_custom_property_narrows_the_workspace_list(
        self, api_key_client, workspace, project, text_property, tagged_item, work_items
    ):
        response = api_key_client.get(
            workspace_list_url(workspace.slug),
            {"filters": json.dumps({f"property__{text_property.id}": "north"})},
        )

        assert response.status_code == status.HTTP_200_OK
        assert result_names(response) == {"Parent item"}

    @pytest.mark.django_db
    def test_unknown_custom_property_is_rejected(self, api_key_client, workspace, project, work_items):
        response = api_key_client.get(
            project_list_url(workspace.slug, project.id),
            {"filters": json.dumps({"property__11111111-1111-4111-8111-111111111111": "north"})},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.contract
class TestPlaceholders:
    @pytest.mark.django_db
    def test_current_user_resolves_to_the_caller(self, api_key_client, workspace, project, work_items):
        response = api_key_client.get(
            project_list_url(workspace.slug, project.id),
            {"pql": "assignee = currentUser()"},
        )

        assert response.status_code == status.HTTP_200_OK
        assert result_names(response) == {"Parent item"}

    @pytest.mark.django_db
    def test_child_of_returns_the_children(self, api_key_client, workspace, project, parent_item, child_item):
        identifier = f"{project.identifier}-{parent_item.sequence_id}"
        response = api_key_client.get(
            project_list_url(workspace.slug, project.id),
            {"pql": f'childOf("{identifier}")'},
        )

        assert response.status_code == status.HTTP_200_OK
        assert result_names(response) == {"Child item"}

    @pytest.mark.django_db
    def test_unresolvable_child_of_is_rejected(self, api_key_client, workspace, project, work_items):
        for identifier in ("FLT-9999", "NOPE-1", "not-an-identifier"):
            response = api_key_client.get(
                project_list_url(workspace.slug, project.id),
                {"pql": f'childOf("{identifier}")'},
            )
            assert response.status_code == status.HTTP_400_BAD_REQUEST, f"{identifier} got {response.status_code}"

    @pytest.mark.django_db
    def test_child_of_an_invisible_work_item_is_rejected(self, api_key_client, workspace, project, hidden_item):
        """Resolving an identifier the caller may not see is a 400, the same
        answer as an identifier that does not exist."""
        identifier = f"{hidden_item.project.identifier}-{hidden_item.sequence_id}"
        response = api_key_client.get(
            project_list_url(workspace.slug, project.id),
            {"pql": f'childOf("{identifier}")'},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Hidden item" not in response.content.decode()

    @pytest.mark.django_db
    def test_relative_date_placeholder_resolves(self, api_key_client, workspace, project, work_items, parent_item):
        parent_item.target_date = "2020-01-01"
        parent_item.save(update_fields=["target_date"])

        response = api_key_client.get(
            project_list_url(workspace.slug, project.id),
            {"pql": "target_date < now() - 7d"},
        )

        assert response.status_code == status.HTTP_200_OK
        assert result_names(response) == {"Parent item"}


@pytest.mark.contract
class TestWorkspaceList:
    @pytest.mark.django_db
    def test_lists_work_items_across_projects(self, api_key_client, workspace, project, work_items):
        response = api_key_client.get(workspace_list_url(workspace.slug))

        assert response.status_code == status.HTTP_200_OK
        assert result_names(response) == {"Parent item", "Child item", "Teammate item"}

    @pytest.mark.django_db
    def test_never_returns_a_work_item_from_a_foreign_project(
        self, api_key_client, workspace, project, work_items, hidden_item
    ):
        response = api_key_client.get(workspace_list_url(workspace.slug))

        assert response.status_code == status.HTTP_200_OK
        assert "Hidden item" not in result_names(response)
        assert str(hidden_item.id) not in response.content.decode()

    @pytest.mark.django_db
    def test_a_filter_cannot_reach_a_foreign_project(self, api_key_client, workspace, project, work_items, hidden_item):
        """Naming the foreign project explicitly must not widen the scope."""
        response = api_key_client.get(
            workspace_list_url(workspace.slug),
            {"filters": json.dumps({"project_id": str(hidden_item.project_id)})},
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["results"] == []

    @pytest.mark.django_db
    def test_non_member_of_the_workspace_is_refused(self, api_client, workspace, outsider, work_items):
        from plane.db.models.api import APIToken

        token = APIToken.objects.create(user=outsider, label="outsider", token="outsider-token-12345")
        api_client.credentials(HTTP_X_API_KEY=token.token)

        response = api_client.get(workspace_list_url(workspace.slug))

        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


@pytest.mark.contract
class TestWorkspaceCount:
    """The envelope is what plane-sdk's `WorkItemGroupedCountResponse`
    validates: grouped_by, sub_grouped_by, total_count and grouped_counts."""

    @pytest.mark.django_db
    def test_ungrouped_envelope(self, api_key_client, workspace, project, work_items):
        response = api_key_client.get(workspace_count_url(workspace.slug))

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {
            "grouped_by": None,
            "sub_grouped_by": None,
            "total_count": 3,
            "grouped_counts": {},
        }

    @pytest.mark.django_db
    def test_grouped_envelope(self, api_key_client, workspace, project, work_items):
        response = api_key_client.get(workspace_count_url(workspace.slug), {"group_by": "priority"})

        assert response.status_code == status.HTTP_200_OK
        assert response.data["grouped_by"] == "priority"
        assert response.data["sub_grouped_by"] is None
        assert response.data["total_count"] == 3
        assert response.data["grouped_counts"] == {
            "urgent": {"count": 1},
            "low": {"count": 1},
            "medium": {"count": 1},
        }

    @pytest.mark.django_db
    def test_sub_grouped_envelope(self, api_key_client, workspace, project, state, done_state, work_items):
        response = api_key_client.get(
            workspace_count_url(workspace.slug),
            {"group_by": "priority", "sub_group_by": "state_id"},
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["sub_grouped_by"] == "state_id"
        assert response.data["grouped_counts"]["urgent"] == {
            "count": 1,
            "sub_grouped_counts": {str(state.id): {"count": 1}},
        }
        assert response.data["grouped_counts"]["medium"] == {
            "count": 1,
            "sub_grouped_counts": {str(done_state.id): {"count": 1}},
        }

    @pytest.mark.django_db
    def test_null_dimension_uses_the_none_key(self, api_key_client, workspace, project, work_items):
        response = api_key_client.get(workspace_count_url(workspace.slug), {"group_by": "target_date"})

        assert response.status_code == status.HTTP_200_OK
        assert response.data["grouped_counts"] == {"None": {"count": 3}}

    @pytest.mark.django_db
    def test_sub_group_by_alone_is_rejected(self, api_key_client, workspace, project, work_items):
        response = api_key_client.get(workspace_count_url(workspace.slug), {"sub_group_by": "state_id"})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_unknown_group_by_is_rejected(self, api_key_client, workspace, project, work_items):
        for params in ({"group_by": "created_by__password"}, {"group_by": "priority", "sub_group_by": "name"}):
            response = api_key_client.get(workspace_count_url(workspace.slug), params)
            assert response.status_code == status.HTTP_400_BAD_REQUEST, f"{params} got {response.status_code}"

    @pytest.mark.django_db
    def test_count_never_includes_a_foreign_project(self, api_key_client, workspace, project, work_items, hidden_item):
        total = api_key_client.get(workspace_count_url(workspace.slug))
        grouped = api_key_client.get(workspace_count_url(workspace.slug), {"group_by": "project_id"})

        assert total.data["total_count"] == 3
        assert grouped.data["total_count"] == 3
        assert set(grouped.data["grouped_counts"]) == {str(project.id)}

    @pytest.mark.django_db
    def test_count_honors_filters(self, api_key_client, workspace, project, work_items):
        response = api_key_client.get(
            workspace_count_url(workspace.slug),
            {"pql": 'priority in ("urgent", "low")', "group_by": "priority"},
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["total_count"] == 2
        assert set(response.data["grouped_counts"]) == {"urgent", "low"}

    @pytest.mark.django_db
    def test_count_honors_a_custom_property_filter(
        self, api_key_client, workspace, project, text_property, tagged_item, work_items
    ):
        response = api_key_client.get(
            workspace_count_url(workspace.slug),
            {"filters": json.dumps({f"property__{text_property.id}": "north"})},
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["total_count"] == 1
