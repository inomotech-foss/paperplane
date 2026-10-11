# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The click-together (rich) filters with what the query language can do: the hierarchy,
words in the title, completion dates, before / after, negation, text custom fields."""

import json
from datetime import date, datetime, timezone

import pytest
from django.utils import timezone as django_timezone
from rest_framework import status

from plane.db.models import Issue, IssueProperty, IssuePropertyValue, Project, ProjectMember, State
from plane.utils.issue_type import link_starter_type


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(workspace=workspace, name="Sales Funnel", identifier="ISFUN")
    State.objects.create(workspace=workspace, project=project, name="Backlog", color="#000000", default=True)
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    return project


def item(project, name, parent=None, **fields):
    return Issue.objects.create(
        workspace=project.workspace,
        project=project,
        name=name,
        parent=parent,
        **fields,
        type=link_starter_type(project),
    )


@pytest.fixture
def funnel(project):
    ford = item(project, "Ford Werke GmbH")
    story = item(project, "TCU 2027 rollout", parent=ford, start_date=date(2026, 3, 1))
    quote = item(project, "Quote TCU hardware", parent=story, start_date=date(2026, 5, 1))
    invoice = item(project, "Invoice batch 1", parent=quote, target_date=date(2026, 7, 15))
    vw = item(project, "Volkswagen AG")
    vw_story = item(project, "Transporter SLA", parent=vw, start_date=date(2026, 1, 10))
    return {"ford": ford, "story": story, "quote": quote, "invoice": invoice, "vw": vw, "vw_story": vw_story}


def names(session_client, workspace, project, expression):
    response = session_client.get(
        f"/api/workspaces/{workspace.slug}/projects/{project.id}/issues/", {"filters": json.dumps(expression)}
    )
    assert response.status_code == status.HTTP_200_OK, response.data
    return {result["name"] for result in response.data["results"]}


@pytest.mark.contract
@pytest.mark.django_db
class TestHierarchyFilters:
    def test_below_a_work_item_at_any_depth(self, session_client, workspace, project, funnel):
        found = names(session_client, workspace, project, {"ancestor_id": str(funnel["ford"].id)})

        assert found == {"TCU 2027 rollout", "Quote TCU hardware", "Invoice batch 1"}

    def test_below_any_of_several(self, session_client, workspace, project, funnel):
        found = names(
            session_client,
            workspace,
            project,
            {"ancestor_id__in": f"{funnel['quote'].id},{funnel['vw'].id}"},
        )

        assert found == {"Invoice batch 1", "Transporter SLA"}

    def test_directly_under_a_work_item(self, session_client, workspace, project, funnel):
        found = names(session_client, workspace, project, {"parent_id": str(funnel["ford"].id)})

        assert found == {"TCU 2027 rollout"}

    def test_not_below_a_customer(self, session_client, workspace, project, funnel):
        found = names(session_client, workspace, project, {"not": {"ancestor_id": str(funnel["ford"].id)}})

        assert found == {"Ford Werke GmbH", "Volkswagen AG", "Transporter SLA"}

    def test_a_parent_cycle_does_not_hang(self, session_client, workspace, project, funnel):
        Issue.objects.filter(pk=funnel["ford"].pk).update(parent=funnel["invoice"])

        found = names(session_client, workspace, project, {"ancestor_id": str(funnel["quote"].id)})

        assert "Invoice batch 1" in found and "Ford Werke GmbH" in found


@pytest.mark.contract
@pytest.mark.django_db
class TestTitleAndDateFilters:
    def test_title_contains_ignores_case(self, session_client, workspace, project, funnel):
        found = names(session_client, workspace, project, {"name__icontains": "tcu"})

        assert found == {"TCU 2027 rollout", "Quote TCU hardware"}

    def test_before_and_after_exclude_the_day_itself(self, session_client, workspace, project, funnel):
        after = names(session_client, workspace, project, {"start_date__gt": "2026-03-01"})
        before = names(session_client, workspace, project, {"start_date__lt": "2026-03-01"})

        assert after == {"Quote TCU hardware"}
        assert before == {"Transporter SLA"}

    def test_completed_on_a_day_and_in_a_range(self, session_client, workspace, project, funnel):
        Issue.objects.filter(pk=funnel["invoice"].pk).update(
            completed_at=datetime(2026, 7, 20, 15, 30, tzinfo=timezone.utc)
        )
        Issue.objects.filter(pk=funnel["quote"].pk).update(completed_at=django_timezone.now())

        on_day = names(session_client, workspace, project, {"completed_at": "2026-07-20"})
        in_range = names(session_client, workspace, project, {"completed_at__range": "2026-07-01,2026-07-31"})
        after = names(session_client, workspace, project, {"completed_at__gt": "2026-07-20"})

        assert on_day == {"Invoice batch 1"}
        assert in_range == {"Invoice batch 1"}
        assert after == {"Quote TCU hardware"}

    def test_state_is_not_via_a_not_group(self, session_client, workspace, project, funnel):
        done = State.objects.create(
            workspace=workspace, project=project, name="Done", color="#16a34a", group="completed"
        )
        Issue.objects.filter(pk=funnel["invoice"].pk).update(state=done)

        found = names(session_client, workspace, project, {"not": {"state_id__in": str(done.id)}})

        assert "Invoice batch 1" not in found and len(found) == 5


@pytest.mark.contract
@pytest.mark.django_db
class TestCustomPropertyFilters:
    def prop(self, project, name, property_type):
        return IssueProperty.objects.create(
            workspace=project.workspace, project=project, name=name, display_name=name, property_type=property_type
        )

    def value(self, issue, prop, **value):
        IssuePropertyValue.objects.create(
            issue=issue, property=prop, project=issue.project, workspace=issue.workspace, **value
        )

    def test_text_contains(self, session_client, workspace, project, funnel):
        number = self.prop(project, "Invoice number", "TEXT")
        self.value(funnel["invoice"], number, value_text="INV-2026-001")
        self.value(funnel["quote"], number, value_text="Q-2026-17")

        found = names(session_client, workspace, project, {f"customproperty_{number.id}__icontains": "inv"})

        assert found == {"Invoice batch 1"}

    def test_date_after_and_before(self, session_client, workspace, project, funnel):
        paid = self.prop(project, "Paid on", "DATETIME")
        self.value(funnel["invoice"], paid, value_date=datetime(2026, 7, 20, tzinfo=timezone.utc))
        self.value(funnel["quote"], paid, value_date=datetime(2026, 7, 21, 9, 0, tzinfo=timezone.utc))

        after = names(session_client, workspace, project, {f"customproperty_{paid.id}__gt": "2026-07-20"})
        before = names(session_client, workspace, project, {f"customproperty_{paid.id}__lt": "2026-07-21"})

        assert after == {"Quote TCU hardware"}
        assert before == {"Invoice batch 1"}

    def test_contains_only_works_on_text(self, session_client, workspace, project, funnel):
        amount = self.prop(project, "Amount", "DECIMAL")

        response = session_client.get(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/issues/",
            {"filters": json.dumps({f"customproperty_{amount.id}__icontains": "1"})},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.contract
@pytest.mark.django_db
class TestWorkItemPickerSearch:
    def test_only_work_items_with_children_in_number_order(self, session_client, workspace, project, funnel):
        response = session_client.get(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/search-issues/",
            {"has_children": "true", "limit": "2000"},
        )

        assert response.status_code == status.HTTP_200_OK
        assert [result["name"] for result in response.data] == [
            "Ford Werke GmbH",
            "TCU 2027 rollout",
            "Quote TCU hardware",
            "Volkswagen AG",
        ]

    def test_the_limit_is_capped(self, session_client, workspace, project, funnel):
        response = session_client.get(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/search-issues/", {"limit": "1"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
