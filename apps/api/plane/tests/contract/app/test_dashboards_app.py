# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for dashboards and their PQL widgets.

The data is a small sales funnel: two customers, each with a sales story and
invoices carrying an amount and a due date. The widgets asked of it are the
ones a sales team wants: revenue per month, revenue per customer, invoices by
state, and a single total for one customer over a period.
"""

from datetime import datetime, timezone
from decimal import Decimal

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import (
    Dashboard,
    DashboardWidget,
    Issue,
    IssueProperty,
    IssuePropertyValue,
    IssueType,
    Project,
    ProjectIssueType,
    ProjectMember,
    PropertyTypeChoices,
    State,
    User,
    WorkspaceMember,
)


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Sales", identifier="SALES", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def types(db, workspace, project):
    result = {}
    for name in ("Customer", "Sales story", "Invoice"):
        issue_type = IssueType.objects.create(workspace=workspace, name=name)
        ProjectIssueType.objects.create(project=project, issue_type=issue_type, workspace=workspace)
        result[name] = issue_type
    return result


@pytest.fixture
def states(db, workspace, project):
    return {
        name: State.objects.create(name=name, group=group, project=project, workspace=workspace)
        for name, group in (("Open", "unstarted"), ("Paid", "completed"))
    }


@pytest.fixture
def amount(db, workspace, project, types):
    return IssueProperty.objects.create(
        name="amount",
        display_name="Amount",
        property_type=PropertyTypeChoices.DECIMAL,
        project=project,
        workspace=workspace,
        issue_type=types["Invoice"],
    )


@pytest.fixture
def due(db, workspace, project, types):
    return IssueProperty.objects.create(
        name="due_date",
        display_name="Due date",
        property_type=PropertyTypeChoices.DATETIME,
        project=project,
        workspace=workspace,
        issue_type=types["Invoice"],
    )


@pytest.fixture
def funnel(db, workspace, project, types, states, amount, due):
    def item(name, issue_type, state, parent=None):
        return Issue.objects.create(
            name=name, workspace=workspace, project=project, type=issue_type, state=state, parent=parent
        )

    def invoice(name, parent, state, value, due_on):
        inv = item(name, types["Invoice"], state, parent=parent)
        IssuePropertyValue.objects.create(
            issue=inv, property=amount, value_number=Decimal(value), project=project, workspace=workspace
        )
        IssuePropertyValue.objects.create(
            issue=inv,
            property=due,
            value_date=datetime(*due_on, tzinfo=timezone.utc),
            project=project,
            workspace=workspace,
        )
        return inv

    acme = item("Acme", types["Customer"], states["Open"])
    acme_story = item("Acme rollout", types["Sales story"], states["Open"], parent=acme)
    globex = item("Globex", types["Customer"], states["Open"])
    globex_story = item("Globex pilot", types["Sales story"], states["Open"], parent=globex)

    invoice("ACME-1", acme_story, states["Paid"], "1000", (2026, 1, 15))
    invoice("ACME-2", acme_story, states["Paid"], "500", (2026, 3, 2))
    invoice("ACME-3", acme_story, states["Open"], "250", (2026, 3, 20))
    invoice("GLX-1", globex_story, states["Paid"], "99", (2026, 2, 1))
    return {"acme": acme, "globex": globex}


def dashboards_url(workspace):
    return f"/api/workspaces/{workspace.slug}/dashboards/"


def widgets_url(workspace, dashboard_id):
    return f"/api/workspaces/{workspace.slug}/dashboards/{dashboard_id}/widgets/"


def identifier(issue):
    return f"{issue.project.identifier}-{issue.sequence_id}"


def rows(payload):
    return {row["name"]: row["count"] for row in payload["data"]}


@pytest.mark.contract
class TestDashboardCrud:
    @pytest.mark.django_db
    def test_create_list_update_delete(self, session_client, workspace, create_user):
        response = session_client.post(dashboards_url(workspace), {"name": "Sales", "description": "Pipeline"})
        assert response.status_code == status.HTTP_201_CREATED, response.data
        dashboard_id = response.data["id"]
        assert response.data["is_owner"] is True
        assert response.data["widget_count"] == 0

        response = session_client.get(dashboards_url(workspace))
        assert [row["name"] for row in response.data] == ["Sales"]

        response = session_client.patch(f"{dashboards_url(workspace)}{dashboard_id}/", {"name": "Sales funnel"})
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Sales funnel"

        response = session_client.delete(f"{dashboards_url(workspace)}{dashboard_id}/")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Dashboard.objects.filter(pk=dashboard_id).exists()

    @pytest.mark.django_db
    def test_private_dashboards_are_only_visible_to_their_owner(self, session_client, workspace, create_user):
        other = User.objects.create(email="other@example.test", username="other")
        WorkspaceMember.objects.create(workspace=workspace, member=other, role=15)
        Dashboard.objects.create(workspace=workspace, name="Mine", owned_by=create_user, access=0)
        Dashboard.objects.create(workspace=workspace, name="Shared", owned_by=create_user, access=1)

        other_client = APIClient()
        other_client.force_authenticate(user=other)
        response = other_client.get(dashboards_url(workspace))
        assert [row["name"] for row in response.data] == ["Shared"]

        mine = Dashboard.objects.get(name="Mine")
        response = other_client.get(f"{dashboards_url(workspace)}{mine.id}/")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.django_db
    def test_only_the_owner_or_an_admin_edits(self, session_client, workspace, create_user):
        other = User.objects.create(email="other@example.test", username="other")
        WorkspaceMember.objects.create(workspace=workspace, member=other, role=15)
        shared = Dashboard.objects.create(workspace=workspace, name="Shared", owned_by=create_user, access=1)

        other_client = APIClient()
        other_client.force_authenticate(user=other)
        response = other_client.patch(f"{dashboards_url(workspace)}{shared.id}/", {"name": "Hijacked"})
        assert response.status_code == status.HTTP_403_FORBIDDEN
        response = other_client.post(widgets_url(workspace, shared.id), {"title": "x", "chart_type": "number"})
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.django_db
    def test_retrieve_includes_widgets(self, session_client, workspace, create_user):
        dashboard = Dashboard.objects.create(workspace=workspace, name="Sales", owned_by=create_user)
        DashboardWidget.objects.create(
            dashboard=dashboard, workspace=workspace, title="Total", chart_type="number", metric={"function": "count"}
        )
        response = session_client.get(f"{dashboards_url(workspace)}{dashboard.id}/")
        assert response.status_code == status.HTTP_200_OK
        assert [widget["title"] for widget in response.data["widgets"]] == ["Total"]


@pytest.mark.contract
class TestWidgetValidation:
    @pytest.fixture
    def dashboard(self, db, workspace, create_user):
        return Dashboard.objects.create(workspace=workspace, name="Sales", owned_by=create_user)

    @pytest.mark.django_db
    def test_bad_query_names_the_field(self, session_client, workspace, dashboard):
        response = session_client.post(
            widgets_url(workspace, dashboard.id),
            {"title": "Bad", "chart_type": "number", "query": "state ="},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "query" in response.data

    @pytest.mark.django_db
    def test_sum_needs_a_decimal_property(self, session_client, workspace, dashboard, due):
        response = session_client.post(
            widgets_url(workspace, dashboard.id),
            {"title": "Bad", "chart_type": "number", "metric": {"function": "sum", "field": f"property:{due.id}"}},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "metric" in response.data

    @pytest.mark.django_db
    def test_bar_chart_needs_a_dimension(self, session_client, workspace, dashboard):
        response = session_client.post(
            widgets_url(workspace, dashboard.id), {"title": "Bad", "chart_type": "bar"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "dimension" in response.data

    @pytest.mark.django_db
    def test_unknown_dimension_field(self, session_client, workspace, dashboard):
        response = session_client.post(
            widgets_url(workspace, dashboard.id),
            {"title": "Bad", "chart_type": "bar", "dimension": {"field": "colour"}},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "dimension" in response.data

    @pytest.mark.django_db
    def test_definition_is_normalised_on_save(self, session_client, workspace, dashboard, amount):
        response = session_client.post(
            widgets_url(workspace, dashboard.id),
            {
                "title": "Revenue",
                "chart_type": "line",
                "metric": {"function": "sum", "field": f"property:{amount.id}"},
                "dimension": {"field": "target_date"},
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED, response.data
        assert response.data["dimension"] == {"field": "target_date", "bucket": "month"}


@pytest.mark.contract
class TestWidgetData:
    def preview(self, client, workspace, **definition):
        response = client.post(f"{dashboards_url(workspace)}preview/", definition, format="json")
        assert response.status_code == status.HTTP_200_OK, response.data
        return response.data

    @pytest.mark.django_db
    def test_count_by_state(self, session_client, workspace, funnel):
        payload = self.preview(
            session_client, workspace, chart_type="bar", query='type = "Invoice"', dimension={"field": "state"}
        )
        assert rows(payload) == {"Paid": 3, "Open": 1}
        assert payload["total"] == 4
        assert payload["row_count"] == 4

    @pytest.mark.django_db
    def test_revenue_per_month_fills_the_gaps(self, session_client, workspace, funnel, amount, due):
        payload = self.preview(
            session_client,
            workspace,
            chart_type="line",
            query='type = "Invoice" AND state = "Paid"',
            metric={"function": "sum", "field": f"property:{amount.id}"},
            dimension={"field": f"property:{due.id}", "bucket": "month"},
        )
        assert [(row["key"], row["name"], row["count"]) for row in payload["data"]] == [
            ("2026-01-01", "Jan 2026", 1000),
            ("2026-02-01", "Feb 2026", 99),
            ("2026-03-01", "Mar 2026", 500),
        ]
        assert payload["total"] == 1599

    @pytest.mark.django_db
    def test_revenue_per_customer_through_the_hierarchy(self, session_client, workspace, funnel, amount, types):
        payload = self.preview(
            session_client,
            workspace,
            chart_type="pie",
            query='type = "Invoice"',
            metric={"function": "sum", "field": f"property:{amount.id}"},
            dimension={"field": f"ancestor:{types['Customer'].id}"},
        )
        assert rows(payload) == {
            f"{identifier(funnel['acme'])} Acme": 1750,
            f"{identifier(funnel['globex'])} Globex": 99,
        }

    @pytest.mark.django_db
    def test_one_customer_over_a_period_as_a_number(self, session_client, workspace, funnel, amount, due):
        payload = self.preview(
            session_client,
            workspace,
            chart_type="number",
            query=(
                f'descendantOf("{identifier(funnel["acme"])}") AND type = "Invoice" '
                'AND cf["Due date"] >= "2026-03-01" AND cf["Due date"] < "2026-04-01"'
            ),
            metric={"function": "sum", "field": f"property:{amount.id}"},
        )
        assert payload["data"] == []
        assert payload["total"] == 750
        assert payload["row_count"] == 2

    @pytest.mark.django_db
    def test_series_split_state_by_customer(self, session_client, workspace, funnel, types):
        payload = self.preview(
            session_client,
            workspace,
            chart_type="bar",
            query='type = "Invoice"',
            dimension={"field": "state"},
            series={"field": f"ancestor:{types['Customer'].id}"},
        )
        acme_key = str(funnel["acme"].id)
        globex_key = str(funnel["globex"].id)
        by_name = {row["name"]: row for row in payload["data"]}
        assert by_name["Paid"][acme_key] == 2
        assert by_name["Paid"][globex_key] == 1
        assert by_name["Open"][acme_key] == 1
        assert by_name["Open"][globex_key] == 0
        assert payload["schema"][acme_key].endswith("Acme")

    @pytest.mark.django_db
    def test_avg_min_max(self, session_client, workspace, funnel, amount):
        for function, expected in (("avg", 462.25), ("min", 99), ("max", 1000)):
            payload = self.preview(
                session_client,
                workspace,
                chart_type="number",
                query='type = "Invoice"',
                metric={"function": function, "field": f"property:{amount.id}"},
            )
            assert payload["total"] == expected, function

    @pytest.mark.django_db
    def test_saved_widget_data_endpoint(self, session_client, workspace, create_user, funnel, amount):
        dashboard = Dashboard.objects.create(workspace=workspace, name="Sales", owned_by=create_user)
        widget = DashboardWidget.objects.create(
            dashboard=dashboard,
            workspace=workspace,
            title="Revenue by type",
            chart_type="bar",
            metric={"function": "sum", "field": f"property:{amount.id}"},
            dimension={"field": "type"},
        )
        response = session_client.get(f"{widgets_url(workspace, dashboard.id)}{widget.id}/data/")
        assert response.status_code == status.HTTP_200_OK
        assert rows(response.data) == {"Invoice": 1849, "Customer": 0, "Sales story": 0}

    @pytest.mark.django_db
    def test_query_errors_are_reported_not_swallowed(self, session_client, workspace, funnel):
        response = session_client.post(
            f"{dashboards_url(workspace)}preview/",
            {"chart_type": "number", "query": 'state = "Overdue"'},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Overdue" in response.data["error"]

    @pytest.mark.django_db
    def test_data_respects_project_visibility(self, session_client, workspace, funnel, create_user):
        outsider = User.objects.create(email="outsider@example.test", username="outsider")
        WorkspaceMember.objects.create(workspace=workspace, member=outsider, role=15)
        hidden = Project.objects.create(name="Hidden", identifier="HID", workspace=workspace, created_by=outsider)
        ProjectMember.objects.create(project=hidden, member=outsider, role=20, is_active=True)
        state = State.objects.create(name="Open", group="unstarted", project=hidden, workspace=workspace)
        Issue.objects.create(name="Secret", workspace=workspace, project=hidden, state=state)

        payload = self.preview(session_client, workspace, chart_type="bar", dimension={"field": "project"})
        assert rows(payload) == {"Sales": 8}

    @pytest.mark.django_db
    def test_options_list_types_and_properties(self, session_client, workspace, funnel, amount, due, types):
        response = session_client.get(f"{dashboards_url(workspace)}options/")
        assert response.status_code == status.HTTP_200_OK
        assert {prop["name"] for prop in response.data["properties"]} == {"Amount", "Due date"}
        assert [prop["name"] for prop in response.data["metric_properties"]] == ["Amount"]
        assert {issue_type["name"] for issue_type in response.data["types"]} == {"Customer", "Sales story", "Invoice"}
