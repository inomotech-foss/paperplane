# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from plane.db.models import (
    Issue,
    IssueProperty,
    IssuePropertyValue,
    IssueType,
    Project,
    ProjectIssueType,
    ProjectMember,
    State,
)


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(workspace=workspace, name="Sales", identifier="SALES", created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    State.objects.create(workspace=workspace, project=project, name="Backlog", color="#888888", default=True)
    State.objects.create(workspace=workspace, project=project, name="In Progress", color="#888888", group="started")
    return project


def seed(**overrides):
    output = StringIO()
    call_command("seed_sales_funnel", stdout=output, **{"workspace": "test-workspace", "project": "SALES", **overrides})
    return output.getvalue()


@pytest.mark.contract
@pytest.mark.django_db
class TestSeedSalesFunnel:
    def test_creates_the_funnel(self, project, create_user):
        output = seed()

        names = set(IssueType.objects.filter(project_issue_types__project=project).values_list("name", flat=True))
        assert {"Customer", "Sales story", "Quote", "Invoice"} <= names
        assert IssueProperty.objects.filter(project=project, name="invoice_amount").exists()
        assert set(State.objects.filter(project=project).values_list("name", flat=True)) >= {"Sent", "Paid", "Won"}

        by_type = {
            name: Issue.objects.filter(project=project, type__name=name).count()
            for name in ("Customer", "Sales story", "Quote", "Invoice")
        }
        assert by_type == {"Customer": 4, "Sales story": 6, "Quote": 8, "Invoice": 8}
        # every invoice sits under a quote, under a story, under a customer
        for invoice in Issue.objects.filter(project=project, type__name="Invoice"):
            assert invoice.parent.type.name == "Quote"
            assert invoice.parent.parent.type.name == "Sales story"
            assert invoice.parent.parent.parent.type.name == "Customer"
            assert invoice.target_date is not None
            assert invoice.created_by == create_user
        assert IssuePropertyValue.objects.filter(project=project, property__name="invoice_amount").count() == 8
        assert "SALES-1" in output and "Acme GmbH" in output
        project.refresh_from_db()
        assert project.is_issue_type_enabled is True

    def test_second_run_does_not_duplicate(self, project):
        seed()
        output = seed()
        assert "already seeded" in output
        assert Issue.objects.filter(project=project).count() == 26
        assert IssueType.objects.filter(workspace=project.workspace, name="Customer").count() == 1

    def test_reset_recreates_the_work_items(self, project):
        seed()
        first = set(Issue.objects.filter(project=project).values_list("id", flat=True))
        seed(reset=True)
        second = set(Issue.objects.filter(project=project).values_list("id", flat=True))
        assert len(second) == 26 and not (first & second)
        assert ProjectIssueType.objects.filter(project=project).count() == 5  # default + the four funnel types

    def test_unknown_workspace_or_project(self, project):
        with pytest.raises(CommandError, match="No workspace"):
            seed(workspace="nope")
        with pytest.raises(CommandError, match="No project"):
            seed(project="NOPE")

    def test_seeded_data_answers_the_sales_questions(self, project, session_client, workspace):
        seed()
        acme = Issue.objects.get(project=project, name="Acme GmbH")
        url = f"/api/workspaces/{workspace.slug}/projects/{project.id}/issues/"
        response = session_client.get(
            url,
            {"pql": f'type = "Invoice" AND state = "Paid" AND descendantOf("SALES-{acme.sequence_id}")'},
        )
        assert response.status_code == 200
        names = {row["name"] for row in response.json()["results"]}
        assert names == {"Acme retrofit 1/2", "Acme retrofit 2/2", "Acme service Q1"}
