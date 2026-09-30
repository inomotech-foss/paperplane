# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Property values derived from the work item hierarchy: inherited, looked up, rolled up."""

from datetime import date
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import (
    Issue,
    IssueProperty,
    IssuePropertyOption,
    IssuePropertyValue,
    IssueType,
    Project,
    ProjectIssueType,
    ProjectMember,
    State,
)
from plane.utils.derived_properties import refresh_derived_values
from plane.utils.issue_property import build_custom_property_lookup_q


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(
        workspace=workspace, name="Sales Funnel", identifier="ISFUN", is_issue_type_enabled=True
    )
    State.objects.create(workspace=workspace, project=project, name="Backlog", color="#000000", default=True)
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    return project


@pytest.fixture
def types(workspace, project):
    found = {}
    for name in ("Customer", "Sales story", "Quote", "Invoice"):
        issue_type = IssueType.objects.create(workspace=workspace, name=name)
        ProjectIssueType.objects.create(project=project, issue_type=issue_type, workspace=workspace)
        found[name] = issue_type
    return found


def item(project, name, issue_type, parent=None, **fields):
    return Issue.objects.create(
        workspace=project.workspace, project=project, name=name, type=issue_type, parent=parent, **fields
    )


@pytest.fixture
def funnel(project, types):
    """Ford > TCU 2027 > Quote > two invoices, and a second customer without children."""
    ford = item(project, "Ford Werke GmbH", types["Customer"])
    story = item(project, "TCU 2027", types["Sales story"], parent=ford, start_date=date(2026, 3, 1))
    quote = item(project, "Quote TCU", types["Quote"], parent=story, start_date=date(2026, 2, 15))
    invoice_1 = item(project, "Invoice 1", types["Invoice"], parent=quote, target_date=date(2026, 7, 15))
    invoice_2 = item(project, "Invoice 2", types["Invoice"], parent=quote, start_date=date(2026, 4, 1))
    vw = item(project, "Volkswagen AG", types["Customer"])
    return {"ford": ford, "story": story, "quote": quote, "invoice_1": invoice_1, "invoice_2": invoice_2, "vw": vw}


def prop(project, name, property_type, derivation="NONE", config=None, **fields):
    return IssueProperty.objects.create(
        workspace=project.workspace,
        project=project,
        name=name,
        display_name=name,
        property_type=property_type,
        derivation=derivation,
        derivation_config=config or {},
        **fields,
    )


def set_value(issue, property_obj, **value):
    IssuePropertyValue.objects.filter(issue=issue, property=property_obj).delete(soft=False)
    return IssuePropertyValue.objects.create(
        issue=issue, property=property_obj, project=issue.project, workspace=issue.workspace, **value
    )


def values(property_obj):
    """`{work item name: (value, is_derived)}` of a property."""
    found = {}
    for row in IssuePropertyValue.objects.filter(property=property_obj).select_related("issue"):
        value = next(
            getattr(row, column)
            for column in (
                "value_text",
                "value_number",
                "value_option_id",
                "value_date",
                "value_boolean",
                "value_user_id",
                "value_issue_id",
            )
            if getattr(row, column) is not None
        )
        found[row.issue.name] = (value, row.is_derived)
    return found


def values_url(workspace, project, issue):
    return f"/api/workspaces/{workspace.slug}/projects/{project.id}/issues/{issue.id}/property-values/"


def properties_url(workspace, project, property_obj=None):
    base = f"/api/workspaces/{workspace.slug}/projects/{project.id}/issue-properties/"
    return f"{base}{property_obj.id}/" if property_obj else base


@pytest.mark.contract
@pytest.mark.django_db
class TestInherit:
    def test_a_value_flows_down_and_an_own_value_overrides_it_below(self, project, funnel):
        segment = prop(project, "Segment", "TEXT", "INHERIT")
        set_value(funnel["ford"], segment, value_text="Automotive")
        set_value(funnel["quote"], segment, value_text="Fleet")

        refresh_derived_values(project.id)

        assert values(segment) == {
            "Ford Werke GmbH": ("Automotive", False),
            "TCU 2027": ("Automotive", True),
            "Quote TCU": ("Fleet", False),
            "Invoice 1": ("Fleet", True),
            "Invoice 2": ("Fleet", True),
        }

    def test_clearing_an_own_value_brings_the_inherited_one_back(
        self, session_client, workspace, project, funnel, django_capture_on_commit_callbacks
    ):
        segment = prop(project, "Segment", "TEXT", "INHERIT")
        set_value(funnel["ford"], segment, value_text="Automotive")
        set_value(funnel["quote"], segment, value_text="Fleet")
        refresh_derived_values(project.id)

        with django_capture_on_commit_callbacks(execute=True):
            response = session_client.put(
                values_url(workspace, project, funnel["quote"]), {str(segment.id): None}, format="json"
            )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["values"][str(segment.id)] == "Automotive"
        assert response.data["derived"][str(segment.id)] == {"source_issue_id": str(funnel["ford"].id)}
        assert values(segment)["Invoice 1"] == ("Automotive", True)

    def test_moving_a_subtree_takes_the_new_parents_value(self, project, funnel, django_capture_on_commit_callbacks):
        segment = prop(project, "Segment", "TEXT", "INHERIT")
        set_value(funnel["ford"], segment, value_text="Automotive")
        set_value(funnel["vw"], segment, value_text="Logistics")
        refresh_derived_values(project.id)

        with django_capture_on_commit_callbacks(execute=True):
            funnel["story"].parent = funnel["vw"]
            funnel["story"].save()

        assert values(segment)["Invoice 2"] == ("Logistics", True)

    def test_switching_back_to_manual_keeps_own_values_and_drops_inherited_ones(self, project, funnel):
        segment = prop(project, "Segment", "TEXT", "INHERIT")
        set_value(funnel["ford"], segment, value_text="Automotive")
        refresh_derived_values(project.id)

        segment.derivation = "NONE"
        segment.save()
        refresh_derived_values(project.id)

        assert values(segment) == {"Ford Werke GmbH": ("Automotive", False)}


@pytest.mark.contract
@pytest.mark.django_db
class TestLookup:
    def test_every_work_item_references_its_customer(self, project, types, funnel):
        customer = prop(
            project,
            "Customer",
            "RELATION",
            "LOOKUP",
            {"issue_type": str(types["Customer"].id), "source": "item", "include_self": True},
            relation_type="ISSUE",
        )

        refresh_derived_values(project.id)

        ford = funnel["ford"].id
        assert values(customer) == {
            "Ford Werke GmbH": (ford, True),
            "TCU 2027": (ford, True),
            "Quote TCU": (ford, True),
            "Invoice 1": (ford, True),
            "Invoice 2": (ford, True),
            "Volkswagen AG": (funnel["vw"].id, True),
        }

    def test_without_include_self_a_customer_has_no_customer(self, project, types, funnel):
        customer = prop(
            project,
            "Customer",
            "RELATION",
            "LOOKUP",
            {"issue_type": str(types["Customer"].id), "source": "item", "include_self": False},
            relation_type="ISSUE",
        )

        refresh_derived_values(project.id)

        assert "Ford Werke GmbH" not in values(customer)
        assert values(customer)["TCU 2027"] == (funnel["ford"].id, True)

    def test_the_reference_is_queryable_by_identifier(self, project, types, funnel):
        customer = prop(
            project,
            "Customer",
            "RELATION",
            "LOOKUP",
            {"issue_type": str(types["Customer"].id), "source": "item", "include_self": True},
            relation_type="ISSUE",
        )
        refresh_derived_values(project.id)
        ford = funnel["ford"]

        by_identifier = build_custom_property_lookup_q(customer, "exact", f"ISFUN-{ford.sequence_id}")
        by_name = build_custom_property_lookup_q(customer, "exact", "Volkswagen AG")

        assert set(Issue.issue_objects.filter(by_identifier).values_list("name", flat=True)) == {
            "Ford Werke GmbH",
            "TCU 2027",
            "Quote TCU",
            "Invoice 1",
            "Invoice 2",
        }
        assert list(Issue.issue_objects.filter(by_name).values_list("name", flat=True)) == ["Volkswagen AG"]

    def test_an_option_of_the_customer_shows_on_everything_below(self, project, types, funnel):
        industry = prop(project, "Industry", "OPTION", issue_type=types["Customer"])
        automotive = IssuePropertyOption.objects.create(
            property=industry, name="Automotive", project=project, workspace=project.workspace
        )
        set_value(funnel["ford"], industry, value_option=automotive)
        customer_industry = prop(
            project,
            "Customer industry",
            "OPTION",
            "LOOKUP",
            {"issue_type": str(types["Customer"].id), "source": str(industry.id), "include_self": True},
        )

        refresh_derived_values(project.id)

        assert values(customer_industry)["Invoice 2"] == (automotive.id, True)
        # names resolve against the source's options
        query = build_custom_property_lookup_q(customer_industry, "exact", "Automotive")
        assert Issue.issue_objects.filter(query).count() == 5


@pytest.mark.contract
@pytest.mark.django_db
class TestRollup:
    def amount(self, project, types):
        return prop(project, "Invoice amount", "DECIMAL", issue_type=types["Invoice"])

    def test_sums_the_invoices_below_every_level(self, project, types, funnel):
        amount = self.amount(project, types)
        set_value(funnel["invoice_1"], amount, value_number=Decimal("1000.50"))
        set_value(funnel["invoice_2"], amount, value_number=Decimal("250"))
        invoiced = prop(
            project,
            "Invoiced",
            "DECIMAL",
            "ROLLUP",
            {
                "source": str(amount.id),
                "function": "sum",
                "scope": "descendants",
                "issue_type": str(types["Invoice"].id),
            },
        )

        refresh_derived_values(project.id)

        found = values(invoiced)
        assert found["Ford Werke GmbH"] == (Decimal("1250.5"), True)
        assert found["Quote TCU"] == (Decimal("1250.5"), True)
        # no work items below: no value rather than 0
        assert "Invoice 1" not in found
        assert "Volkswagen AG" not in found

    def test_a_changed_invoice_updates_every_ancestor(
        self, session_client, workspace, project, types, funnel, django_capture_on_commit_callbacks
    ):
        amount = self.amount(project, types)
        set_value(funnel["invoice_1"], amount, value_number=Decimal("100"))
        invoiced = prop(project, "Invoiced", "DECIMAL", "ROLLUP", {"source": str(amount.id), "function": "sum"})
        refresh_derived_values(project.id)

        with django_capture_on_commit_callbacks(execute=True):
            response = session_client.put(
                values_url(workspace, project, funnel["invoice_2"]), {str(amount.id): 900}, format="json"
            )

        assert response.status_code == status.HTTP_200_OK
        assert values(invoiced)["Ford Werke GmbH"] == (Decimal("1000"), True)

    def test_archiving_an_invoice_takes_it_out(self, project, types, funnel, django_capture_on_commit_callbacks):
        amount = self.amount(project, types)
        set_value(funnel["invoice_1"], amount, value_number=Decimal("100"))
        set_value(funnel["invoice_2"], amount, value_number=Decimal("900"))
        invoiced = prop(project, "Invoiced", "DECIMAL", "ROLLUP", {"source": str(amount.id), "function": "sum"})
        refresh_derived_values(project.id)

        with django_capture_on_commit_callbacks(execute=True):
            funnel["invoice_2"].archived_at = timezone.now().date()
            funnel["invoice_2"].save()

        assert values(invoiced)["Ford Werke GmbH"] == (Decimal("100"), True)

    def test_counts_direct_children_only(self, project, funnel):
        children = prop(
            project, "Children", "DECIMAL", "ROLLUP", {"source": "items", "function": "count", "scope": "children"}
        )

        refresh_derived_values(project.id)

        found = values(children)
        assert found["Ford Werke GmbH"] == (Decimal(1), True)
        assert found["Quote TCU"] == (Decimal(2), True)

    def test_earliest_start_below(self, project, funnel):
        first_start = prop(
            project, "First start", "DATETIME", "ROLLUP", {"source": "start_date", "function": "earliest"}
        )

        refresh_derived_values(project.id)

        assert values(first_start)["Ford Werke GmbH"][0].date() == date(2026, 2, 15)
        assert values(first_start)["Quote TCU"][0].date() == date(2026, 4, 1)

    def test_effort_including_the_item_itself(self, project, funnel):
        hours = prop(project, "Hours", "DECIMAL")
        set_value(funnel["story"], hours, value_number=Decimal("2"))
        set_value(funnel["invoice_1"], hours, value_number=Decimal("3.25"))
        total = prop(
            project,
            "Total hours",
            "DECIMAL",
            "ROLLUP",
            {"source": str(hours.id), "function": "sum", "include_self": True},
        )

        refresh_derived_values(project.id)

        assert values(total)["TCU 2027"] == (Decimal("5.25"), True)
        assert values(total)["Invoice 1"] == (Decimal("3.25"), True)

    def test_a_parent_cycle_does_not_hang(self, project, types, funnel):
        Issue.objects.filter(pk=funnel["ford"].pk).update(parent=funnel["invoice_1"])
        children = prop(project, "Below", "DECIMAL", "ROLLUP", {"source": "items", "function": "count"})

        refresh_derived_values(project.id)

        assert values(children)["Quote TCU"] == (Decimal(4), True)


@pytest.mark.contract
@pytest.mark.django_db
class TestConfiguration:
    def create(self, client, workspace, project, **data):
        return client.post(
            properties_url(workspace, project), {"name": data.get("display_name", "X"), **data}, format="json"
        )

    def test_creating_a_lookup_computes_its_values(self, session_client, workspace, project, types, funnel):
        response = self.create(
            session_client,
            workspace,
            project,
            display_name="Customer",
            property_type="RELATION",
            relation_type="ISSUE",
            derivation="LOOKUP",
            derivation_config={"issue_type": str(types["Customer"].id)},
        )

        assert response.status_code == status.HTTP_201_CREATED, response.data
        assert response.data["derivation_config"] == {
            "issue_type": str(types["Customer"].id),
            "source": "item",
            "include_self": True,
        }
        assert IssuePropertyValue.objects.filter(property_id=response.data["id"], is_derived=True).count() == 6

    @pytest.mark.parametrize(
        "data, message",
        [
            ({"property_type": "RELATION", "relation_type": "ISSUE"}, "ancestor"),
            ({"property_type": "TEXT", "derivation": "LOOKUP", "derivation_config": {"source": "item"}}, "issue_type"),
            (
                {"property_type": "DECIMAL", "derivation": "ROLLUP", "derivation_config": {"source": "items"}},
                "function",
            ),
            (
                {
                    "property_type": "DATETIME",
                    "derivation": "ROLLUP",
                    "derivation_config": {"source": "items", "function": "count"},
                },
                "DECIMAL",
            ),
            (
                {
                    "property_type": "DECIMAL",
                    "derivation": "ROLLUP",
                    "is_required": True,
                    "derivation_config": {"source": "items", "function": "count"},
                },
                "required",
            ),
        ],
    )
    def test_rejects_invalid_settings(self, session_client, workspace, project, types, data, message):
        response = self.create(session_client, workspace, project, **data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert message in str(response.data)

    def test_rejects_a_roll_up_of_a_roll_up(self, session_client, workspace, project):
        children = prop(project, "Children", "DECIMAL", "ROLLUP", {"source": "items", "function": "count"})

        response = self.create(
            session_client,
            workspace,
            project,
            property_type="DECIMAL",
            derivation="ROLLUP",
            derivation_config={"source": str(children.id), "function": "sum"},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "itself looked up or rolled up" in str(response.data)

    def test_computed_values_cannot_be_set(self, session_client, workspace, project, funnel):
        children = prop(project, "Children", "DECIMAL", "ROLLUP", {"source": "items", "function": "count"})

        response = session_client.put(
            values_url(workspace, project, funnel["ford"]), {str(children.id): 5}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "computed from the work item hierarchy" in str(response.data)

    def test_a_property_others_are_derived_from_cannot_be_deleted(self, session_client, workspace, project):
        hours = prop(project, "Hours", "DECIMAL")
        prop(project, "Total hours", "DECIMAL", "ROLLUP", {"source": str(hours.id), "function": "sum"})

        response = session_client.delete(properties_url(workspace, project, hours))

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Total hours" in response.data["error"]
        assert IssueProperty.objects.filter(pk=hours.pk).exists()

    def test_a_property_with_values_cannot_become_a_roll_up(self, session_client, workspace, project, funnel):
        hours = prop(project, "Hours", "DECIMAL")
        set_value(funnel["story"], hours, value_number=Decimal("2"))

        response = session_client.patch(
            properties_url(workspace, project, hours),
            {"derivation": "ROLLUP", "derivation_config": {"source": "items", "function": "count"}},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "empty" in str(response.data)

    def test_the_bulk_endpoint_serves_derived_values(self, session_client, workspace, project, types, funnel):
        customer = prop(
            project,
            "Customer",
            "RELATION",
            "LOOKUP",
            {"issue_type": str(types["Customer"].id), "source": "item", "include_self": True},
            relation_type="ISSUE",
        )
        refresh_derived_values(project.id)

        response = session_client.get(f"/api/workspaces/{workspace.slug}/projects/{project.id}/issue-property-values/")

        assert response.status_code == status.HTTP_200_OK
        assert response.data[str(funnel["invoice_2"].id)][str(customer.id)] == str(funnel["ford"].id)
