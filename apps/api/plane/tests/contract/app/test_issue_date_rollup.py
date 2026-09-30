# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Dates rolled up from the work items below a parent, for the timeline."""

from datetime import date

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import Issue, Project, ProjectMember, State, User, WorkspaceMember


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(workspace=workspace, name="Sales Funnel", identifier="ISFUN")
    State.objects.create(workspace=workspace, project=project, name="Backlog", color="#000000", default=True)
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    return project


def item(project, name, parent=None, start=None, end=None, **fields):
    return Issue.objects.create(
        workspace=project.workspace,
        project=project,
        name=name,
        parent=parent,
        start_date=start,
        target_date=end,
        **fields,
    )


def url(workspace, project, *issues):
    ids = ",".join(str(issue.id) for issue in issues)
    return f"/api/workspaces/{workspace.slug}/projects/{project.id}/issue-date-rollups/?issue_ids={ids}"


@pytest.fixture
def funnel(project):
    """customer > story > quote > two invoices, dated at every level below the customer."""
    customer = item(project, "Ford")
    story = item(project, "TCU 2027", parent=customer, start=date(2026, 3, 1), end=date(2026, 6, 30))
    quote = item(project, "Quote", parent=story, start=date(2026, 2, 15), end=date(2026, 3, 1))
    item(project, "Invoice 1", parent=quote, end=date(2026, 7, 15))
    item(project, "Invoice 2", parent=quote, start=date(2026, 4, 1), end=date(2026, 4, 30))
    return customer, story, quote


@pytest.mark.contract
@pytest.mark.django_db
class TestIssueDateRollup:
    def test_spans_all_descendants_at_any_depth(self, session_client, workspace, project, funnel):
        customer, story, quote = funnel

        response = session_client.get(url(workspace, project, customer, story, quote))

        assert response.status_code == status.HTTP_200_OK
        assert response.data[str(customer.id)] == {
            "start_date": "2026-02-15",
            "target_date": "2026-07-15",
            "children_count": 1,
            "descendants_count": 4,
        }
        assert response.data[str(story.id)]["start_date"] == "2026-02-15"
        # an invoice with only a due date counts as that single day
        assert response.data[str(quote.id)] == {
            "start_date": "2026-04-01",
            "target_date": "2026-07-15",
            "children_count": 2,
            "descendants_count": 2,
        }

    def test_leaves_out_work_items_without_children(self, session_client, workspace, project):
        lonely = item(project, "Lonely", start=date(2026, 1, 1), end=date(2026, 1, 2))

        response = session_client.get(url(workspace, project, lonely))

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {}

    def test_children_without_dates_give_an_empty_span(self, session_client, workspace, project):
        parent = item(project, "Parent")
        item(project, "Undated child", parent=parent)

        response = session_client.get(url(workspace, project, parent))

        assert response.data[str(parent.id)] == {
            "start_date": None,
            "target_date": None,
            "children_count": 1,
            "descendants_count": 1,
        }

    def test_ignores_archived_deleted_and_draft_descendants(self, session_client, workspace, project):
        parent = item(project, "Parent")
        item(project, "Live", parent=parent, start=date(2026, 5, 1), end=date(2026, 5, 2))
        archived = item(project, "Archived", parent=parent, start=date(2026, 1, 1), end=date(2026, 12, 31))
        Issue.objects.filter(pk=archived.pk).update(archived_at=timezone.now().date())
        item(project, "Draft", parent=parent, start=date(2025, 1, 1), end=date(2027, 1, 1), is_draft=True)
        deleted = item(project, "Deleted", parent=parent, start=date(2024, 1, 1), end=date(2028, 1, 1))
        Issue.objects.filter(pk=deleted.pk).update(deleted_at=timezone.now())

        response = session_client.get(url(workspace, project, parent))

        assert response.data[str(parent.id)] == {
            "start_date": "2026-05-01",
            "target_date": "2026-05-02",
            "children_count": 1,
            "descendants_count": 1,
        }

    def test_survives_a_parent_cycle(self, session_client, workspace, project):
        a = item(project, "A", start=date(2026, 1, 1), end=date(2026, 1, 1))
        b = item(project, "B", parent=a, start=date(2026, 2, 1), end=date(2026, 2, 1))
        # corrupt data: close the loop behind the ORM's back
        Issue.objects.filter(pk=a.pk).update(parent=b)

        response = session_client.get(url(workspace, project, a, b))

        assert response.status_code == status.HTTP_200_OK
        assert response.data[str(a.id)]["descendants_count"] == 1
        assert response.data[str(b.id)]["descendants_count"] == 1

    def test_restricted_guests_only_get_dates_from_their_own_work_items(
        self, session_client, workspace, project, create_user
    ):
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=5)
        ProjectMember.objects.filter(project=project, member=create_user).update(role=5)
        project.guest_view_all_features = False
        project.save()
        other = User.objects.create(email="other@plane.so", username="other")
        parent = item(project, "Parent")
        mine = item(project, "Mine", parent=parent, start=date(2026, 5, 1), end=date(2026, 5, 2))
        theirs = item(project, "Theirs", parent=parent, start=date(2026, 1, 1), end=date(2026, 12, 31))
        Issue.objects.filter(pk__in=[parent.pk, mine.pk]).update(created_by=create_user)
        Issue.objects.filter(pk=theirs.pk).update(created_by=other)

        response = session_client.get(url(workspace, project, parent))

        assert response.status_code == status.HTTP_200_OK
        assert response.data[str(parent.id)]["start_date"] == "2026-05-01"
        assert response.data[str(parent.id)]["target_date"] == "2026-05-02"

    def test_an_empty_request_answers_nothing(self, session_client, workspace, project):
        response = session_client.get(f"/api/workspaces/{workspace.slug}/projects/{project.id}/issue-date-rollups/")

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {}

    def test_rejects_ids_that_are_not_ids(self, session_client, workspace, project):
        response = session_client.get(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/issue-date-rollups/?issue_ids=abc"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_non_members_are_refused(self, session_client, workspace, project, create_user):
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=15)
        ProjectMember.objects.filter(project=project, member=create_user).delete()
        parent = item(project, "Parent")

        response = session_client.get(url(workspace, project, parent))

        assert response.status_code == status.HTTP_403_FORBIDDEN
