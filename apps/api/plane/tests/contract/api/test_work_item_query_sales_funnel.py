# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for PQL over a work item hierarchy.

The scenario is a sales funnel: work item types Customer, Sales story, Quote
and Invoice nested through `parent`, each with its own custom properties and
states. The questions a person asks of it ("every invoice of customer Acme
that is paid and due in 2026", "everything for customer Acme") must be
answerable with names, not ids, and across the whole hierarchy.
"""

from datetime import datetime, timezone
from decimal import Decimal

import pytest
from rest_framework import status

from plane.db.models import (
    Issue,
    IssueAssignee,
    IssueProperty,
    IssuePropertyOption,
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
    """Customer -> Sales story -> Quote -> Invoice."""
    result = {}
    for name in ("Customer", "Sales story", "Quote", "Invoice"):
        issue_type = IssueType.objects.create(workspace=workspace, name=name, is_default=name == "Customer")
        ProjectIssueType.objects.create(project=project, issue_type=issue_type, workspace=workspace)
        result[name] = issue_type
    return result


@pytest.fixture
def states(db, workspace, project):
    result = {}
    for name, group in (("Open", "unstarted"), ("Sent", "started"), ("Paid", "completed"), ("Won", "completed")):
        result[name] = State.objects.create(name=name, group=group, project=project, workspace=workspace)
    return result


@pytest.fixture
def properties(db, workspace, project, types):
    amount = IssueProperty.objects.create(
        name="amount",
        display_name="Amount",
        property_type=PropertyTypeChoices.DECIMAL,
        project=project,
        workspace=workspace,
        issue_type=types["Invoice"],
    )
    due = IssueProperty.objects.create(
        name="due_date",
        display_name="Due date",
        property_type=PropertyTypeChoices.DATETIME,
        project=project,
        workspace=workspace,
        issue_type=types["Invoice"],
    )
    region = IssueProperty.objects.create(
        name="region",
        display_name="Region",
        property_type=PropertyTypeChoices.OPTION,
        project=project,
        workspace=workspace,
        issue_type=types["Customer"],
    )
    north = IssuePropertyOption.objects.create(property=region, name="North", project=project, workspace=workspace)
    south = IssuePropertyOption.objects.create(property=region, name="South", project=project, workspace=workspace)
    return {"amount": amount, "due": due, "region": region, "north": north, "south": south}


def make_item(name, project, issue_type, state, parent=None, user=None):
    return Issue.objects.create(
        name=name,
        workspace=project.workspace,
        project=project,
        type=issue_type,
        state=state,
        parent=parent,
        created_by=user,
    )


def set_value(issue, property_obj, **columns):
    IssuePropertyValue.objects.create(
        issue=issue, property=property_obj, project=issue.project, workspace=issue.workspace, **columns
    )


@pytest.fixture
def funnel(db, project, types, states, properties, create_user):
    """Two customers; Acme has a story with a quote and three invoices."""
    acme = make_item("Acme", project, types["Customer"], states["Open"], user=create_user)
    set_value(acme, properties["region"], value_option=properties["north"])
    globex = make_item("Globex", project, types["Customer"], states["Open"], user=create_user)
    set_value(globex, properties["region"], value_option=properties["south"])

    story = make_item("Acme rollout", project, types["Sales story"], states["Won"], parent=acme, user=create_user)
    quote = make_item("Rollout quote", project, types["Quote"], states["Sent"], parent=story, user=create_user)

    def invoice(name, state, amount, due):
        item = make_item(name, project, types["Invoice"], state, parent=quote, user=create_user)
        set_value(item, properties["amount"], value_number=Decimal(amount))
        set_value(item, properties["due"], value_date=datetime(*due, tzinfo=timezone.utc))
        return item

    paid_2026 = invoice("INV-2026-1", states["Paid"], "1000", (2026, 3, 15))
    open_2026 = invoice("INV-2026-2", states["Sent"], "250.5", (2026, 9, 1))
    paid_2025 = invoice("INV-2025-9", states["Paid"], "400", (2025, 12, 31))

    globex_story = make_item(
        "Globex pilot", project, types["Sales story"], states["Open"], parent=globex, user=create_user
    )
    globex_invoice = make_item(
        "GLX-1", project, types["Invoice"], states["Paid"], parent=globex_story, user=create_user
    )
    set_value(globex_invoice, properties["amount"], value_number=Decimal("99"))
    set_value(globex_invoice, properties["due"], value_date=datetime(2026, 1, 10, tzinfo=timezone.utc))

    return {
        "acme": acme,
        "globex": globex,
        "story": story,
        "quote": quote,
        "paid_2026": paid_2026,
        "open_2026": open_2026,
        "paid_2025": paid_2025,
        "globex_story": globex_story,
        "globex_invoice": globex_invoice,
    }


def identifier(issue):
    return f"{issue.project.identifier}-{issue.sequence_id}"


def list_url(workspace, project):
    return f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/work-items/"


def workspace_url(workspace):
    return f"/api/v1/workspaces/{workspace.slug}/work-items/"


def names(response):
    assert response.status_code == status.HTTP_200_OK, response.data
    return {row["name"] for row in response.data["results"]}


@pytest.mark.contract
class TestHierarchyQueries:
    @pytest.mark.django_db
    def test_child_of_is_direct_children_only(self, api_key_client, workspace, project, funnel):
        response = api_key_client.get(list_url(workspace, project), {"pql": f'childOf("{identifier(funnel["acme"])}")'})
        assert names(response) == {"Acme rollout"}

    @pytest.mark.django_db
    def test_descendant_of_walks_the_whole_subtree(self, api_key_client, workspace, project, funnel):
        response = api_key_client.get(
            list_url(workspace, project), {"pql": f'descendantOf("{identifier(funnel["acme"])}")'}
        )
        assert names(response) == {"Acme rollout", "Rollout quote", "INV-2026-1", "INV-2026-2", "INV-2025-9"}

    @pytest.mark.django_db
    def test_ancestor_field_accepts_identifiers(self, api_key_client, workspace, project, funnel):
        response = api_key_client.get(
            list_url(workspace, project), {"pql": f'ancestor = "{identifier(funnel["story"])}"'}
        )
        assert names(response) == {"Rollout quote", "INV-2026-1", "INV-2026-2", "INV-2025-9"}

    @pytest.mark.django_db
    def test_invoices_of_a_customer_paid_and_due_in_a_year(self, api_key_client, workspace, project, funnel):
        query = (
            f'descendantOf("{identifier(funnel["acme"])}") AND type = "Invoice" AND status = "Paid" '
            'AND cf["Due date"] >= "2026-01-01" AND cf["Due date"] <= "2026-12-31"'
        )
        response = api_key_client.get(list_url(workspace, project), {"pql": query})
        assert names(response) == {"INV-2026-1"}

    @pytest.mark.django_db
    def test_everything_for_a_customer_by_name(self, api_key_client, workspace, project, funnel):
        query = 'descendantOf("%s") OR name = "Acme"' % identifier(funnel["acme"])
        response = api_key_client.get(list_url(workspace, project), {"pql": query})
        assert names(response) == {"Acme", "Acme rollout", "Rollout quote", "INV-2026-1", "INV-2026-2", "INV-2025-9"}

    @pytest.mark.django_db
    def test_unknown_identifier_is_a_400(self, api_key_client, workspace, project, funnel):
        response = api_key_client.get(list_url(workspace, project), {"pql": 'descendantOf("SALES-999")'})
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "SALES-999" in response.data["error"]


@pytest.mark.contract
class TestNameResolution:
    @pytest.mark.django_db
    def test_type_and_state_by_name(self, api_key_client, workspace, project, funnel):
        response = api_key_client.get(list_url(workspace, project), {"pql": 'type = "invoice" AND state = "paid"'})
        assert names(response) == {"INV-2026-1", "INV-2025-9", "GLX-1"}

    @pytest.mark.django_db
    def test_names_in_lists_and_negations(self, api_key_client, workspace, project, funnel):
        response = api_key_client.get(list_url(workspace, project), {"pql": 'type in ("Customer", "Quote")'})
        assert names(response) == {"Acme", "Globex", "Rollout quote"}

        response = api_key_client.get(list_url(workspace, project), {"pql": 'type != "Invoice" AND state != "Open"'})
        assert names(response) == {"Acme rollout", "Rollout quote"}

    @pytest.mark.django_db
    def test_members_and_projects_by_name(self, api_key_client, workspace, project, funnel, create_user):
        IssueAssignee.objects.create(issue=funnel["quote"], assignee=create_user, project=project, workspace=workspace)
        for who in (create_user.email, create_user.display_name):
            response = api_key_client.get(
                list_url(workspace, project), {"pql": f'assignee = "{who}" AND project = "sales"'}
            )
            assert names(response) == {"Rollout quote"}

    @pytest.mark.django_db
    def test_unknown_name_is_a_400_naming_the_field(self, api_key_client, workspace, project, funnel):
        response = api_key_client.get(list_url(workspace, project), {"pql": 'state = "Overdue"'})
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Overdue" in response.data["error"]

    @pytest.mark.django_db
    def test_same_name_in_several_projects_matches_all_of_them(
        self, api_key_client, workspace, project, funnel, create_user
    ):
        other = Project.objects.create(name="Support", identifier="SUP", workspace=workspace, created_by=create_user)
        ProjectMember.objects.create(project=other, member=create_user, role=20, is_active=True)
        paid = State.objects.create(name="Paid", group="completed", project=other, workspace=workspace)
        Issue.objects.create(
            name="Support invoice", workspace=workspace, project=other, state=paid, created_by=create_user
        )

        response = api_key_client.get(workspace_url(workspace), {"pql": 'state = "Paid"'})
        assert names(response) == {"INV-2026-1", "INV-2025-9", "GLX-1", "Support invoice"}

    @pytest.mark.django_db
    def test_a_project_scoped_query_only_sees_that_projects_names(
        self, api_key_client, workspace, project, funnel, create_user
    ):
        other = Project.objects.create(name="Support", identifier="SUP", workspace=workspace, created_by=create_user)
        ProjectMember.objects.create(project=other, member=create_user, role=20, is_active=True)
        State.objects.create(name="Escalated", group="started", project=other, workspace=workspace)

        response = api_key_client.get(list_url(workspace, project), {"pql": 'state = "Escalated"'})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_names_of_projects_the_caller_cannot_see_do_not_resolve(self, api_key_client, workspace, project, funnel):
        outsider = User.objects.create(email="outsider@example.test", username="outsider")
        WorkspaceMember.objects.create(workspace=workspace, member=outsider, role=15)
        hidden = Project.objects.create(name="Hidden", identifier="HID", workspace=workspace, created_by=outsider)
        ProjectMember.objects.create(project=hidden, member=outsider, role=20, is_active=True)
        State.objects.create(name="Secret", group="started", project=hidden, workspace=workspace)

        response = api_key_client.get(workspace_url(workspace), {"pql": 'state = "Secret"'})
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.contract
class TestCustomPropertyQueries:
    @pytest.mark.django_db
    def test_decimal_comparisons(self, api_key_client, workspace, project, funnel):
        url = list_url(workspace, project)
        assert names(api_key_client.get(url, {"pql": 'cf["Amount"] >= 400'})) == {"INV-2026-1", "INV-2025-9"}
        assert names(api_key_client.get(url, {"pql": 'cf["Amount"] <= 250.5'})) == {"INV-2026-2", "GLX-1"}
        assert names(api_key_client.get(url, {"pql": 'cf["Amount"] in (99, 1000)'})) == {"INV-2026-1", "GLX-1"}
        assert names(api_key_client.get(url, {"pql": 'cf["amount"] != 99 AND type = "Invoice"'})) == {
            "INV-2026-1",
            "INV-2026-2",
            "INV-2025-9",
        }

    @pytest.mark.django_db
    def test_property_by_id_still_works(self, api_key_client, workspace, project, funnel, properties):
        response = api_key_client.get(list_url(workspace, project), {"pql": f'cf["{properties["amount"].id}"] > 500'})
        assert names(response) == {"INV-2026-1"}

    @pytest.mark.django_db
    def test_date_property_comparisons_treat_a_bare_date_as_the_whole_day(
        self, api_key_client, workspace, project, funnel
    ):
        url = list_url(workspace, project)
        assert names(api_key_client.get(url, {"pql": 'cf["Due date"] = "2025-12-31"'})) == {"INV-2025-9"}
        assert names(api_key_client.get(url, {"pql": 'cf["Due date"] > "2026-03-15"'})) == {"INV-2026-2"}
        assert names(api_key_client.get(url, {"pql": 'cf["Due date"] < "2026-01-01"'})) == {"INV-2025-9"}

    @pytest.mark.django_db
    def test_option_property_by_option_name(self, api_key_client, workspace, project, funnel):
        response = api_key_client.get(list_url(workspace, project), {"pql": 'cf["Region"] = "North"'})
        assert names(response) == {"Acme"}
        response = api_key_client.get(list_url(workspace, project), {"pql": 'cf["Region"] in ("North", "South")'})
        assert names(response) == {"Acme", "Globex"}

    @pytest.mark.django_db
    def test_null_checks_and_or_groups(self, api_key_client, workspace, project, funnel):
        url = list_url(workspace, project)
        assert names(api_key_client.get(url, {"pql": 'type = "Invoice" AND cf["Amount"] is null'})) == set()
        assert names(api_key_client.get(url, {"pql": 'type = "Customer" AND cf["Region"] is not null'})) == {
            "Acme",
            "Globex",
        }
        assert names(api_key_client.get(url, {"pql": 'cf["Amount"] > 500 OR cf["Region"] = "South"'})) == {
            "INV-2026-1",
            "Globex",
        }

    @pytest.mark.django_db
    def test_lookup_the_property_type_cannot_answer_is_a_400(self, api_key_client, workspace, project, funnel):
        response = api_key_client.get(list_url(workspace, project), {"pql": 'cf["Region"] > 5'})
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Region" in response.data["error"]

    @pytest.mark.django_db
    def test_unknown_property_is_a_400(self, api_key_client, workspace, project, funnel):
        response = api_key_client.get(list_url(workspace, project), {"pql": 'cf["Margin"] > 5'})
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Margin" in response.data["error"]

    @pytest.mark.django_db
    def test_json_filters_resolve_names_too(self, api_key_client, workspace, project, funnel):
        import json

        expression = {"and": [{"type_id": "Invoice"}, {"property__Amount__gte": 400}]}
        response = api_key_client.get(list_url(workspace, project), {"filters": json.dumps(expression)})
        assert names(response) == {"INV-2026-1", "INV-2025-9"}


@pytest.mark.contract
class TestTimestampQueries:
    @pytest.mark.django_db
    def test_created_at_compares_on_the_calendar_day(self, api_key_client, workspace, project, funnel):
        url = list_url(workspace, project)
        today = names(api_key_client.get(url, {"pql": "created_at >= now() - 1d AND created_at <= now()"}))
        assert len(today) == 9
        assert names(api_key_client.get(url, {"pql": 'created_at < "2000-01-01"'})) == set()
