# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for `?pql=` on the app (session) work item lists and the
query validate / fields endpoints the web query bar uses."""

import pytest
from rest_framework import status

from plane.db.models import (
    Cycle,
    CycleIssue,
    Issue,
    IssueType,
    Module,
    ModuleIssue,
    Project,
    ProjectIssueType,
    ProjectMember,
    State,
)


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Sales", identifier="SALES", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def invoice_type(db, workspace, project):
    issue_type = IssueType.objects.create(workspace=workspace, name="Invoice")
    ProjectIssueType.objects.create(project=project, issue_type=issue_type, workspace=workspace)
    return issue_type


@pytest.fixture
def paid(db, workspace, project):
    return State.objects.create(name="Paid", group="completed", project=project, workspace=workspace)


@pytest.fixture
def open_state(db, workspace, project):
    return State.objects.create(name="Open", group="unstarted", project=project, workspace=workspace, default=True)


@pytest.fixture
def items(db, workspace, project, invoice_type, paid, open_state):
    customer = Issue.objects.create(name="Acme", workspace=workspace, project=project, state=open_state)
    story = Issue.objects.create(
        name="Acme story", workspace=workspace, project=project, state=open_state, parent=customer
    )
    paid_invoice = Issue.objects.create(
        name="Acme invoice paid", workspace=workspace, project=project, state=paid, parent=story, type=invoice_type
    )
    open_invoice = Issue.objects.create(
        name="Acme invoice open",
        workspace=workspace,
        project=project,
        state=open_state,
        parent=story,
        type=invoice_type,
    )
    return {"customer": customer, "story": story, "paid": paid_invoice, "open": open_invoice}


def identifier(issue):
    return f"{issue.project.identifier}-{issue.sequence_id}"


def names(response):
    assert response.status_code == status.HTTP_200_OK, response.data
    return {row["name"] for row in response.data["results"]}


@pytest.mark.contract
class TestProjectListPql:
    def url(self, workspace, project):
        return f"/api/workspaces/{workspace.slug}/projects/{project.id}/issues/"

    @pytest.mark.django_db
    def test_pql_narrows_the_list(self, session_client, workspace, project, items):
        response = session_client.get(self.url(workspace, project), {"pql": 'type = "Invoice" AND state = "Paid"'})
        assert names(response) == {"Acme invoice paid"}

    @pytest.mark.django_db
    def test_pql_overrides_the_root_only_toggle(self, session_client, workspace, project, items):
        """`sub_issue=false` hides every nested item; a query must still find
        the invoices it asks for, since invoices always have a parent."""
        url = self.url(workspace, project)
        assert names(session_client.get(url, {"sub_issue": "false"})) == {"Acme"}
        query = f'descendantOf("{identifier(items["customer"])}") AND type = "Invoice"'
        assert names(session_client.get(url, {"sub_issue": "false", "pql": query})) == {
            "Acme invoice paid",
            "Acme invoice open",
        }

    @pytest.mark.django_db
    def test_blank_pql_is_ignored(self, session_client, workspace, project, items):
        response = session_client.get(self.url(workspace, project), {"pql": "   "})
        assert len(names(response)) == 4

    @pytest.mark.django_db
    def test_bad_pql_is_a_400_with_a_position(self, session_client, workspace, project, items):
        response = session_client.get(self.url(workspace, project), {"pql": "state ="})
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["position"] == 7

    @pytest.mark.django_db
    def test_pql_composes_with_rich_filters(self, session_client, workspace, project, items, paid):
        response = session_client.get(
            self.url(workspace, project),
            {"pql": 'type = "Invoice"', "filters": f'{{"state_id": "{paid.id}"}}'},
        )
        assert names(response) == {"Acme invoice paid"}


@pytest.mark.contract
class TestOtherListsPql:
    @pytest.mark.django_db
    def test_workspace_list(self, session_client, workspace, project, items):
        response = session_client.get(f"/api/workspaces/{workspace.slug}/issues/", {"pql": 'state = "Paid"'})
        assert names(response) == {"Acme invoice paid"}

    @pytest.mark.django_db
    def test_cycle_and_module_lists(self, session_client, workspace, project, items, create_user):
        cycle = Cycle.objects.create(name="Q1", workspace=workspace, project=project, owned_by=create_user)
        module = Module.objects.create(name="Billing", workspace=workspace, project=project)
        for item in items.values():
            CycleIssue.objects.create(cycle=cycle, issue=item, workspace=workspace, project=project)
            ModuleIssue.objects.create(module=module, issue=item, workspace=workspace, project=project)

        base = f"/api/workspaces/{workspace.slug}/projects/{project.id}"
        for url in (f"{base}/cycles/{cycle.id}/cycle-issues/", f"{base}/modules/{module.id}/issues/"):
            response = session_client.get(url, {"pql": 'type = "Invoice"', "sub_issue": "false"})
            assert response.status_code == status.HTTP_200_OK, (url, response.status_code, response.content)
            assert names(response) == {"Acme invoice paid", "Acme invoice open"}, url


@pytest.mark.contract
class TestValidateEndpoint:
    def url(self, workspace):
        return f"/api/workspaces/{workspace.slug}/work-item-query/validate/"

    @pytest.mark.django_db
    def test_valid_query_returns_its_expression(self, session_client, workspace, project, items):
        response = session_client.post(
            self.url(workspace), {"pql": 'type = "Invoice" AND state = "Paid"', "project_id": str(project.id)}
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["valid"] is True
        assert response.data["expression"] == {"and": [{"type_id": "Invoice"}, {"state_id": "Paid"}]}

    @pytest.mark.django_db
    def test_syntax_error_carries_position(self, session_client, workspace, project, items):
        response = session_client.post(self.url(workspace), {"pql": "state = "})
        assert response.status_code == status.HTTP_200_OK
        assert response.data["valid"] is False
        assert response.data["position"] == 8
        assert "expected" in response.data

    @pytest.mark.django_db
    def test_unknown_name_is_reported(self, session_client, workspace, project, items):
        response = session_client.post(self.url(workspace), {"pql": 'state = "Overdue"'})
        assert response.data["valid"] is False
        assert "Overdue" in response.data["error"]

    @pytest.mark.django_db
    def test_missing_query(self, session_client, workspace):
        response = session_client.post(self.url(workspace), {})
        assert response.data["valid"] is False


@pytest.mark.contract
class TestFieldsEndpoint:
    @pytest.mark.django_db
    def test_lists_fields_aliases_and_functions(self, session_client, workspace):
        response = session_client.get(f"/api/workspaces/{workspace.slug}/work-item-query/fields/")
        assert response.status_code == status.HTTP_200_OK
        by_name = {field["name"]: field for field in response.data["fields"]}
        assert "state" in by_name["state_id"]["aliases"]
        assert "status" in by_name["state_id"]["aliases"]
        assert "descendantOf" in response.data["functions"]
        assert by_name["priority"]["choices"] == ["high", "low", "medium", "none", "urgent"]
