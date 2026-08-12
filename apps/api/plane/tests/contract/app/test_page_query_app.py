# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for the workspace page query endpoint.

The endpoint drops the project filter that ``PageViewSet`` relies on, so the
access rules it keeps are load bearing: a page in a project the caller is not a
member of must never appear, and neither must someone else's private page.
"""

import pytest
from rest_framework import status

from plane.db.models import (
    Label,
    Page,
    PageIndexEntry,
    PageLabel,
    Project,
    ProjectMember,
    ProjectPage,
    User,
    WorkspaceMember,
)

URL = "/api/workspaces/{slug}/page-query/"


def make_project(workspace, user, name, identifier, role=20, guest_view_all_features=True):
    project = Project.objects.create(
        name=name,
        identifier=identifier,
        workspace=workspace,
        created_by=user,
        guest_view_all_features=guest_view_all_features,
    )
    if role is not None:
        ProjectMember.objects.create(project=project, member=user, role=role, is_active=True)
    return project


def make_page(workspace, project, user, name, parent=None, access=Page.PUBLIC_ACCESS):
    page = Page.objects.create(
        name=name,
        description_html="<p></p>",
        workspace=workspace,
        owned_by=user,
        created_by=user,
        parent=parent,
        access=access,
    )
    ProjectPage.objects.create(workspace=workspace, project=project, page=page, created_by=user)
    return page


def make_index_entry(workspace, page, user, key, value, kind=PageIndexEntry.PROPERTY, sort_order=0, color=""):
    return PageIndexEntry.objects.create(
        workspace=workspace,
        page=page,
        kind=kind,
        key=key,
        value=value,
        color=color,
        sort_order=sort_order,
        created_by=user,
    )


@pytest.fixture
def project(db, workspace, create_user):
    return make_project(workspace, create_user, "Alpha", "ALPHA")


@pytest.fixture
def other_user(db):
    return User.objects.create(email="outsider@example.com", username="outsider")


@pytest.mark.contract
@pytest.mark.django_db
class TestPageQueryAccess:
    def test_page_in_a_project_the_user_is_not_a_member_of_is_hidden(
        self, session_client, workspace, project, create_user, other_user
    ):
        WorkspaceMember.objects.create(workspace=workspace, member=other_user, role=15)
        foreign_project = make_project(workspace, other_user, "Beta", "BETA")
        make_page(workspace, foreign_project, other_user, "Foreign Page")
        mine = make_page(workspace, project, create_user, "My Page")

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "index"})

        assert response.status_code == status.HTTP_200_OK
        assert [page["id"] for page in response.data["results"]] == [mine.id]

    def test_private_page_owned_by_someone_else_is_hidden(
        self, session_client, workspace, project, create_user, other_user
    ):
        ProjectMember.objects.create(project=project, member=other_user, role=15, is_active=True)
        make_page(workspace, project, other_user, "Their Secret", access=Page.PRIVATE_ACCESS)
        mine = make_page(workspace, project, create_user, "My Page")

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "index"})

        assert [page["id"] for page in response.data["results"]] == [mine.id]

    def test_guest_without_view_all_features_sees_only_their_own_pages(
        self, session_client, workspace, create_user, other_user
    ):
        restricted = make_project(workspace, create_user, "Gamma", "GAMMA", role=5, guest_view_all_features=False)
        ProjectMember.objects.create(project=restricted, member=other_user, role=20, is_active=True)
        make_page(workspace, restricted, other_user, "Not Mine")
        mine = make_page(workspace, restricted, create_user, "Mine")

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "index"})

        assert [page["id"] for page in response.data["results"]] == [mine.id]

    def test_archived_pages_never_appear(self, session_client, workspace, project, create_user):
        live = make_page(workspace, project, create_user, "Live")
        archived = make_page(workspace, project, create_user, "Archived")
        Page.objects.filter(pk=archived.id).update(archived_at="2026-01-01")

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "index"})

        assert [page["id"] for page in response.data["results"]] == [live.id]

    def test_non_member_of_the_workspace_is_refused(self, api_client, workspace, project, create_user, other_user):
        make_page(workspace, project, create_user, "My Page")
        api_client.force_authenticate(user=other_user)

        response = api_client.get(URL.format(slug=workspace.slug), {"kind": "index"})

        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.contract
@pytest.mark.django_db
class TestPageQueryKinds:
    def test_unknown_kind_is_rejected(self, session_client, workspace, project):
        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "nonsense"})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_index_sorts_by_title(self, session_client, workspace, project, create_user):
        make_page(workspace, project, create_user, "Beta")
        make_page(workspace, project, create_user, "Alpha")

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "index"})

        assert [page["name"] for page in response.data["results"]] == ["Alpha", "Beta"]

    def test_reverse_flips_the_order(self, session_client, workspace, project, create_user):
        make_page(workspace, project, create_user, "Alpha")
        make_page(workspace, project, create_user, "Beta")

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "index", "reverse": "true"})

        assert [page["name"] for page in response.data["results"]] == ["Beta", "Alpha"]

    def test_limit_caps_the_result_set(self, session_client, workspace, project, create_user):
        for index in range(5):
            make_page(workspace, project, create_user, f"Page {index}")

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "index", "limit": "2"})

        assert len(response.data["results"]) == 2

    def test_tree_walks_to_the_requested_depth_only(self, session_client, workspace, project, create_user):
        root = make_page(workspace, project, create_user, "Root")
        child = make_page(workspace, project, create_user, "Child", parent=root)
        make_page(workspace, project, create_user, "Grandchild", parent=child)

        response = session_client.get(
            URL.format(slug=workspace.slug), {"kind": "tree", "root_page_id": str(root.id), "depth": "1"}
        )

        assert [page["name"] for page in response.data["results"]] == ["Child"]

    def test_tree_returns_every_level_within_depth(self, session_client, workspace, project, create_user):
        root = make_page(workspace, project, create_user, "Root")
        child = make_page(workspace, project, create_user, "Child", parent=root)
        make_page(workspace, project, create_user, "Grandchild", parent=child)

        response = session_client.get(
            URL.format(slug=workspace.slug), {"kind": "tree", "root_page_id": str(root.id), "depth": "2"}
        )

        assert [page["name"] for page in response.data["results"]] == ["Child", "Grandchild"]

    def test_tree_survives_a_parent_cycle(self, session_client, workspace, project, create_user):
        root = make_page(workspace, project, create_user, "Root")
        child = make_page(workspace, project, create_user, "Child", parent=root)
        Page.objects.filter(pk=root.id).update(parent=child)

        response = session_client.get(
            URL.format(slug=workspace.slug), {"kind": "tree", "root_page_id": str(root.id), "depth": "20"}
        )

        assert [page["name"] for page in response.data["results"]] == ["Child"]

    def test_tree_without_a_root_returns_nothing(self, session_client, workspace, project, create_user):
        make_page(workspace, project, create_user, "Root")

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "tree"})

        assert response.data["results"] == []

    def test_search_matches_on_title(self, session_client, workspace, project, create_user):
        make_page(workspace, project, create_user, "Release checklist")
        make_page(workspace, project, create_user, "Meeting notes")

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "search", "search": "release"})

        assert [page["name"] for page in response.data["results"]] == ["Release checklist"]

    def test_search_without_a_term_returns_nothing(self, session_client, workspace, project, create_user):
        make_page(workspace, project, create_user, "Release checklist")

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "search"})

        assert response.data["results"] == []

    def test_by_label_matches_on_name(self, session_client, workspace, project, create_user):
        label = Label.objects.create(name="runbook", workspace=workspace, created_by=create_user)
        tagged = make_page(workspace, project, create_user, "Tagged")
        make_page(workspace, project, create_user, "Untagged")
        PageLabel.objects.create(label=label, page=tagged, workspace=workspace, created_by=create_user)

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "by-label", "labels": "runbook"})

        assert [page["id"] for page in response.data["results"]] == [tagged.id]

    def test_by_label_without_labels_returns_nothing(self, session_client, workspace, project, create_user):
        make_page(workspace, project, create_user, "Page")

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "by-label"})

        assert response.data["results"] == []

    def test_label_list_returns_only_labels_in_use(self, session_client, workspace, project, create_user):
        used = Label.objects.create(name="runbook", workspace=workspace, created_by=create_user)
        Label.objects.create(name="unused", workspace=workspace, created_by=create_user)
        page = make_page(workspace, project, create_user, "Tagged")
        PageLabel.objects.create(label=used, page=page, workspace=workspace, created_by=create_user)

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "label-list"})

        assert [label["name"] for label in response.data["results"]] == ["runbook"]

    def test_contributors_counts_pages_per_owner(self, session_client, workspace, project, create_user):
        make_page(workspace, project, create_user, "One")
        make_page(workspace, project, create_user, "Two")

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "contributors"})

        assert response.data["results"] == [{"user_id": create_user.id, "page_count": 2}]

    def test_page_properties_returns_the_requested_columns(self, session_client, workspace, project, create_user):
        page = make_page(workspace, project, create_user, "Runbook")
        make_index_entry(workspace, page, create_user, "Owner", "Team A")
        make_index_entry(workspace, page, create_user, "Status", "Approved", sort_order=1)
        make_index_entry(workspace, page, create_user, "Ignored", "Not asked for", sort_order=2)

        response = session_client.get(
            URL.format(slug=workspace.slug), {"kind": "page-properties", "columns": "Owner,Status"}
        )

        assert response.data["results"][0]["properties"] == {"Owner": "Team A", "Status": "Approved"}

    def test_page_properties_returns_the_colour_of_a_lozenge_value(
        self, session_client, workspace, project, create_user
    ):
        """A status column is unreadable as plain text: green yes and red no are
        the same word until the colour comes with them."""
        page = make_page(workspace, project, create_user, "Control")
        make_index_entry(workspace, page, create_user, "Applicable", "yes", color="green")
        make_index_entry(workspace, page, create_user, "Owner", "Team A", sort_order=1)

        response = session_client.get(
            URL.format(slug=workspace.slug), {"kind": "page-properties", "columns": "Applicable,Owner"}
        )

        result = response.data["results"][0]
        assert result["properties"] == {"Applicable": "yes", "Owner": "Team A"}
        assert result["property_colors"] == {"Applicable": "green"}

    def test_page_properties_matches_column_names_case_insensitively(
        self, session_client, workspace, project, create_user
    ):
        """The macro spells the column the way the author typed it into the
        summary, which is not always how they typed it into the table."""
        page = make_page(workspace, project, create_user, "Runbook")
        make_index_entry(workspace, page, create_user, "owner", "Team A")

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "page-properties", "columns": "Owner"})

        assert response.data["results"][0]["properties"] == {"Owner": "Team A"}

    def test_page_properties_leaves_a_page_without_the_property_empty(
        self, session_client, workspace, project, create_user
    ):
        make_page(workspace, project, create_user, "Bare")

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "page-properties", "columns": "Owner"})

        assert response.data["results"][0]["properties"] == {}

    def test_page_properties_ignores_tasks_and_decisions(self, session_client, workspace, project, create_user):
        page = make_page(workspace, project, create_user, "Mixed")
        make_index_entry(workspace, page, create_user, "Owner", "Team A")
        make_index_entry(workspace, page, create_user, "Owner", "A task", kind=PageIndexEntry.TASK, sort_order=1)

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "page-properties", "columns": "Owner"})

        assert response.data["results"][0]["properties"] == {"Owner": "Team A"}

    def test_page_properties_filters_by_label(self, session_client, workspace, project, create_user):
        label = Label.objects.create(name="runbook", workspace=workspace, created_by=create_user)
        tagged = make_page(workspace, project, create_user, "Tagged")
        make_page(workspace, project, create_user, "Untagged")
        PageLabel.objects.create(label=label, page=tagged, workspace=workspace, created_by=create_user)

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "page-properties", "labels": "runbook"})

        assert [page["id"] for page in response.data["results"]] == [tagged.id]

    def test_page_properties_of_an_unreadable_page_never_leak(
        self, session_client, workspace, project, create_user, other_user
    ):
        """The property values are page content, so they follow exactly the
        access rules the page itself does."""
        WorkspaceMember.objects.create(workspace=workspace, member=other_user, role=15)
        foreign_project = make_project(workspace, other_user, "Beta", "BETA")
        foreign = make_page(workspace, foreign_project, other_user, "Foreign")
        make_index_entry(workspace, foreign, other_user, "Owner", "Secret")

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "page-properties", "columns": "Owner"})

        assert response.data["results"] == []

    def test_task_report_gathers_tasks_from_every_page(self, session_client, workspace, project, create_user):
        first = make_page(workspace, project, create_user, "Alpha")
        second = make_page(workspace, project, create_user, "Beta")
        make_index_entry(workspace, first, create_user, "", "Ship it", kind=PageIndexEntry.TASK)
        make_index_entry(workspace, second, create_user, "", "Write it", kind=PageIndexEntry.TASK)

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "task-report"})

        assert [row["value"] for row in response.data["results"]] == ["Ship it", "Write it"]
        assert response.data["results"][0]["page_name"] == "Alpha"
        assert response.data["results"][0]["project_id"] == project.id

    def test_task_report_filters_by_status(self, session_client, workspace, project, create_user):
        page = make_page(workspace, project, create_user, "Alpha")
        PageIndexEntry.objects.create(
            workspace=workspace, page=page, kind=PageIndexEntry.TASK, value="Done", is_complete=True
        )
        PageIndexEntry.objects.create(
            workspace=workspace, page=page, kind=PageIndexEntry.TASK, value="Open", is_complete=False, sort_order=1
        )

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "task-report", "status": "incomplete"})

        assert [row["value"] for row in response.data["results"]] == ["Open"]

    def test_task_report_rooted_on_a_page_covers_its_subtree(self, session_client, workspace, project, create_user):
        root = make_page(workspace, project, create_user, "Root")
        child = make_page(workspace, project, create_user, "Child", parent=root)
        outside = make_page(workspace, project, create_user, "Elsewhere")
        make_index_entry(workspace, root, create_user, "", "On the root", kind=PageIndexEntry.TASK)
        make_index_entry(workspace, child, create_user, "", "On the child", kind=PageIndexEntry.TASK)
        make_index_entry(workspace, outside, create_user, "", "Not included", kind=PageIndexEntry.TASK)

        response = session_client.get(
            URL.format(slug=workspace.slug), {"kind": "task-report", "root_page_id": str(root.id)}
        )

        assert sorted(row["value"] for row in response.data["results"]) == ["On the child", "On the root"]

    def test_task_report_never_returns_decisions(self, session_client, workspace, project, create_user):
        page = make_page(workspace, project, create_user, "Alpha")
        make_index_entry(workspace, page, create_user, "", "A task", kind=PageIndexEntry.TASK)
        make_index_entry(workspace, page, create_user, "", "A decision", kind=PageIndexEntry.DECISION, sort_order=1)

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "task-report"})

        assert [row["value"] for row in response.data["results"]] == ["A task"]

    def test_decision_report_gathers_decisions(self, session_client, workspace, project, create_user):
        page = make_page(workspace, project, create_user, "Alpha")
        make_index_entry(workspace, page, create_user, "", "Use the boring option", kind=PageIndexEntry.DECISION)

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "decision-report"})

        assert [row["value"] for row in response.data["results"]] == ["Use the boring option"]

    def test_a_report_never_reaches_a_page_the_caller_cannot_read(
        self, session_client, workspace, project, create_user, other_user
    ):
        WorkspaceMember.objects.create(workspace=workspace, member=other_user, role=15)
        foreign_project = make_project(workspace, other_user, "Beta", "BETA")
        foreign = make_page(workspace, foreign_project, other_user, "Foreign")
        make_index_entry(workspace, foreign, other_user, "", "Secret task", kind=PageIndexEntry.TASK)

        response = session_client.get(URL.format(slug=workspace.slug), {"kind": "task-report"})

        assert response.data["results"] == []

    def test_scope_project_limits_to_one_project(self, session_client, workspace, project, create_user):
        other = make_project(workspace, create_user, "Beta", "BETA")
        mine = make_page(workspace, project, create_user, "In Alpha")
        make_page(workspace, other, create_user, "In Beta")

        response = session_client.get(
            URL.format(slug=workspace.slug), {"kind": "index", "scope": "project", "project_id": str(project.id)}
        )

        assert [page["id"] for page in response.data["results"]] == [mine.id]
