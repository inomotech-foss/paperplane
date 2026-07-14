# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from decimal import Decimal
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
    PropertyTypeChoices,
    State,
)


@pytest.fixture
def project(db, workspace, create_user):
    """Create a test project with the user as a member"""
    project = Project.objects.create(
        name="Test Project",
        identifier="TP",
        workspace=workspace,
        created_by=create_user,
    )
    ProjectMember.objects.create(
        project=project,
        member=create_user,
        role=20,  # Admin role
        is_active=True,
    )
    return project


@pytest.fixture
def state(db, project, create_user):
    """Create a test state for work items"""
    return State.objects.create(
        name="Todo",
        group="unstarted",
        color="#0000FF",
        project=project,
        workspace=project.workspace,
        created_by=create_user,
    )


@pytest.fixture
def issue(db, project, state, create_user):
    """Create a test work item"""
    return Issue.objects.create(
        name="Test Work Item",
        project=project,
        workspace=project.workspace,
        state=state,
        created_by=create_user,
    )


@pytest.fixture
def number_property(db, project, create_user):
    """Create a NUMBER work item property"""
    return IssueProperty.objects.create(
        name="Total Amount",
        display_name="Total Amount",
        property_type=PropertyTypeChoices.NUMBER,
        project=project,
        workspace=project.workspace,
        created_by=create_user,
    )


@pytest.fixture
def option_property(db, project, create_user):
    """Create an OPTION work item property with options"""
    issue_property = IssueProperty.objects.create(
        name="Business Unit",
        display_name="Business Unit",
        property_type=PropertyTypeChoices.OPTION,
        project=project,
        workspace=project.workspace,
        created_by=create_user,
    )
    IssuePropertyOption.objects.create(
        name="CONNECT",
        property=issue_property,
        project=project,
        workspace=project.workspace,
        created_by=create_user,
    )
    IssuePropertyOption.objects.create(
        name="MOBILITY",
        property=issue_property,
        project=project,
        workspace=project.workspace,
        created_by=create_user,
    )
    return issue_property


@pytest.fixture
def multi_option_property(db, project, create_user):
    """Create a MULTI_OPTION work item property with options"""
    issue_property = IssueProperty.objects.create(
        name="Regions",
        display_name="Regions",
        property_type=PropertyTypeChoices.MULTI_OPTION,
        project=project,
        workspace=project.workspace,
        created_by=create_user,
    )
    for name in ["EU", "US", "APAC"]:
        IssuePropertyOption.objects.create(
            name=name,
            property=issue_property,
            project=project,
            workspace=project.workspace,
            created_by=create_user,
        )
    return issue_property


def property_url(workspace_slug, project_id, property_id=None):
    url = f"/api/v1/workspaces/{workspace_slug}/projects/{project_id}/issue-properties/"
    if property_id:
        url = f"{url}{property_id}/"
    return url


def option_url(workspace_slug, project_id, property_id, option_id=None):
    url = f"/api/v1/workspaces/{workspace_slug}/projects/{project_id}/issue-properties/{property_id}/options/"
    if option_id:
        url = f"{url}{option_id}/"
    return url


def values_url(workspace_slug, project_id, work_item_id):
    return f"/api/v1/workspaces/{workspace_slug}/projects/{project_id}/work-items/{work_item_id}/property-values/"


def work_items_url(workspace_slug, project_id):
    return f"/api/v1/workspaces/{workspace_slug}/projects/{project_id}/work-items/"


@pytest.mark.contract
class TestIssuePropertyCRUD:
    """Test work item property CRUD endpoints"""

    @pytest.mark.django_db
    def test_create_number_property(self, api_key_client, workspace, project):
        response = api_key_client.post(
            property_url(workspace.slug, project.id),
            {"name": "Total Amount", "property_type": "NUMBER"},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Total Amount"
        assert response.data["display_name"] == "Total Amount"
        assert response.data["property_type"] == "NUMBER"
        assert IssueProperty.objects.count() == 1

    @pytest.mark.django_db
    def test_create_option_property_with_inline_options(self, api_key_client, workspace, project):
        response = api_key_client.post(
            property_url(workspace.slug, project.id),
            {
                "name": "Business Unit",
                "property_type": "OPTION",
                "options": [
                    {"name": "CONNECT", "is_default": True},
                    {"name": "MOBILITY"},
                ],
            },
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert len(response.data["options"]) == 2
        option_names = {option["name"] for option in response.data["options"]}
        assert option_names == {"CONNECT", "MOBILITY"}
        assert IssuePropertyOption.objects.filter(property_id=response.data["id"]).count() == 2

    @pytest.mark.django_db
    def test_create_inline_options_rejected_for_non_option_type(self, api_key_client, workspace, project):
        response = api_key_client.post(
            property_url(workspace.slug, project.id),
            {
                "name": "Total Amount",
                "property_type": "NUMBER",
                "options": [{"name": "CONNECT"}],
            },
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert IssueProperty.objects.count() == 0

    @pytest.mark.django_db
    def test_create_property_invalid_type(self, api_key_client, workspace, project):
        response = api_key_client.post(
            property_url(workspace.slug, project.id),
            {"name": "Bad", "property_type": "SOMETHING"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_create_property_duplicate_name(self, api_key_client, workspace, project, number_property):
        response = api_key_client.post(
            property_url(workspace.slug, project.id),
            {"name": "Total Amount", "property_type": "NUMBER"},
            format="json",
        )

        assert response.status_code == status.HTTP_409_CONFLICT

    @pytest.mark.django_db
    def test_create_property_duplicate_external_id(self, api_key_client, workspace, project):
        payload = {
            "name": "Total Amount",
            "property_type": "NUMBER",
            "external_id": "jira-10001",
            "external_source": "jira",
        }
        response = api_key_client.post(property_url(workspace.slug, project.id), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED

        payload["name"] = "Total Amount 2"
        response = api_key_client.post(property_url(workspace.slug, project.id), payload, format="json")
        assert response.status_code == status.HTTP_409_CONFLICT
        assert "id" in response.data
        assert IssueProperty.objects.count() == 1

    @pytest.mark.django_db
    def test_list_properties(self, api_key_client, workspace, project, number_property, option_property):
        response = api_key_client.get(property_url(workspace.slug, project.id))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 2

    @pytest.mark.django_db
    def test_retrieve_property_includes_options(self, api_key_client, workspace, project, option_property):
        response = api_key_client.get(property_url(workspace.slug, project.id, option_property.id))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Business Unit"
        assert {option["name"] for option in response.data["options"]} == {"CONNECT", "MOBILITY"}

    @pytest.mark.django_db
    def test_patch_property(self, api_key_client, workspace, project, number_property):
        response = api_key_client.patch(
            property_url(workspace.slug, project.id, number_property.id),
            {"display_name": "Contract Value", "is_active": False},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        number_property.refresh_from_db()
        assert number_property.display_name == "Contract Value"
        assert number_property.is_active is False

    @pytest.mark.django_db
    def test_patch_property_type_change_rejected(self, api_key_client, workspace, project, number_property):
        response = api_key_client.patch(
            property_url(workspace.slug, project.id, number_property.id),
            {"property_type": "TEXT"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_delete_property(self, api_key_client, workspace, project, number_property):
        response = api_key_client.delete(property_url(workspace.slug, project.id, number_property.id))

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert IssueProperty.objects.count() == 0

    @pytest.mark.django_db
    def test_unauthenticated_request_rejected(self, api_client, db, workspace, project):
        response = api_client.get(property_url(workspace.slug, project.id))

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.contract
class TestIssuePropertyOptionCRUD:
    """Test work item property option endpoints"""

    @pytest.mark.django_db
    def test_create_option(self, api_key_client, workspace, project, option_property):
        response = api_key_client.post(
            option_url(workspace.slug, project.id, option_property.id),
            {"name": "ENERGY"},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert IssuePropertyOption.objects.filter(property=option_property).count() == 3

    @pytest.mark.django_db
    def test_create_option_on_number_property_rejected(self, api_key_client, workspace, project, number_property):
        response = api_key_client.post(
            option_url(workspace.slug, project.id, number_property.id),
            {"name": "CONNECT"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_create_option_duplicate_external_id(self, api_key_client, workspace, project, option_property):
        payload = {"name": "ENERGY", "external_id": "jira-opt-1", "external_source": "jira"}
        response = api_key_client.post(
            option_url(workspace.slug, project.id, option_property.id), payload, format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED

        payload["name"] = "ENERGY 2"
        response = api_key_client.post(
            option_url(workspace.slug, project.id, option_property.id), payload, format="json"
        )
        assert response.status_code == status.HTTP_409_CONFLICT
        assert "id" in response.data

    @pytest.mark.django_db
    def test_list_options(self, api_key_client, workspace, project, option_property):
        response = api_key_client.get(option_url(workspace.slug, project.id, option_property.id))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 2

    @pytest.mark.django_db
    def test_patch_and_delete_option(self, api_key_client, workspace, project, option_property):
        option = option_property.options.get(name="MOBILITY")

        response = api_key_client.patch(
            option_url(workspace.slug, project.id, option_property.id, option.id),
            {"name": "MOBILITY & TRANSPORT"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        option.refresh_from_db()
        assert option.name == "MOBILITY & TRANSPORT"

        response = api_key_client.delete(option_url(workspace.slug, project.id, option_property.id, option.id))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert option_property.options.count() == 1


@pytest.mark.contract
class TestIssuePropertyValues:
    """Test the work item property values GET/PUT endpoints"""

    @pytest.mark.django_db
    def test_put_and_get_number_value(self, api_key_client, workspace, project, issue, number_property):
        url = values_url(workspace.slug, project.id, issue.id)

        response = api_key_client.put(url, {str(number_property.id): 500000}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["values"][str(number_property.id)] == 500000

        response = api_key_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["values"][str(number_property.id)] == 500000

        value = IssuePropertyValue.objects.get(issue=issue, property=number_property)
        assert value.value_number == Decimal("500000")

    @pytest.mark.django_db
    def test_put_number_value_as_string_and_decimal(self, api_key_client, workspace, project, issue, number_property):
        url = values_url(workspace.slug, project.id, issue.id)

        response = api_key_client.put(url, {str(number_property.id): "1234.56"}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["values"][str(number_property.id)] == 1234.56

    @pytest.mark.django_db
    def test_put_option_value_by_id(self, api_key_client, workspace, project, issue, option_property):
        option = option_property.options.get(name="CONNECT")
        url = values_url(workspace.slug, project.id, issue.id)

        response = api_key_client.put(url, {str(option_property.id): str(option.id)}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["values"][str(option_property.id)] == str(option.id)
        assert response.data["display"][str(option_property.id)] == "CONNECT"

    @pytest.mark.django_db
    def test_put_option_value_by_name(self, api_key_client, workspace, project, issue, option_property):
        option = option_property.options.get(name="CONNECT")
        url = values_url(workspace.slug, project.id, issue.id)

        response = api_key_client.put(url, {str(option_property.id): "CONNECT"}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["values"][str(option_property.id)] == str(option.id)
        assert response.data["display"][str(option_property.id)] == "CONNECT"

    @pytest.mark.django_db
    def test_put_multi_option_values(self, api_key_client, workspace, project, issue, multi_option_property):
        url = values_url(workspace.slug, project.id, issue.id)
        eu_option = multi_option_property.options.get(name="EU")

        response = api_key_client.put(
            url,
            {str(multi_option_property.id): [str(eu_option.id), "US"]},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert set(response.data["display"][str(multi_option_property.id)]) == {"EU", "US"}
        assert IssuePropertyValue.objects.filter(issue=issue, property=multi_option_property).count() == 2

        # Replace semantics: a new PUT replaces the previous selection
        response = api_key_client.put(url, {str(multi_option_property.id): ["APAC"]}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["display"][str(multi_option_property.id)] == ["APAC"]
        assert IssuePropertyValue.objects.filter(issue=issue, property=multi_option_property).count() == 1

    @pytest.mark.django_db
    def test_put_text_date_and_boolean_values(self, api_key_client, workspace, project, issue, create_user):
        text_property = IssueProperty.objects.create(
            name="Customer",
            display_name="Customer",
            property_type=PropertyTypeChoices.TEXT,
            project=project,
            workspace=project.workspace,
        )
        date_property = IssueProperty.objects.create(
            name="Due Diligence Date",
            display_name="Due Diligence Date",
            property_type=PropertyTypeChoices.DATE,
            project=project,
            workspace=project.workspace,
        )
        boolean_property = IssueProperty.objects.create(
            name="Approved",
            display_name="Approved",
            property_type=PropertyTypeChoices.BOOLEAN,
            project=project,
            workspace=project.workspace,
        )
        url = values_url(workspace.slug, project.id, issue.id)

        response = api_key_client.put(
            url,
            {
                str(text_property.id): "ACME GmbH",
                str(date_property.id): "2026-07-13",
                str(boolean_property.id): True,
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["values"][str(text_property.id)] == "ACME GmbH"
        assert response.data["values"][str(date_property.id)].startswith("2026-07-13")
        assert response.data["values"][str(boolean_property.id)] is True

    @pytest.mark.django_db
    def test_put_null_clears_value(self, api_key_client, workspace, project, issue, number_property):
        url = values_url(workspace.slug, project.id, issue.id)
        api_key_client.put(url, {str(number_property.id): 42}, format="json")

        response = api_key_client.put(url, {str(number_property.id): None}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert str(number_property.id) not in response.data["values"]
        assert IssuePropertyValue.objects.filter(issue=issue, property=number_property).count() == 0

    @pytest.mark.django_db
    def test_put_non_numeric_number_rejected(self, api_key_client, workspace, project, issue, number_property):
        url = values_url(workspace.slug, project.id, issue.id)

        response = api_key_client.put(url, {str(number_property.id): "not-a-number"}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert str(number_property.id) in response.data["errors"]
        assert IssuePropertyValue.objects.count() == 0

    @pytest.mark.django_db
    def test_put_unknown_option_rejected(self, api_key_client, workspace, project, issue, option_property):
        url = values_url(workspace.slug, project.id, issue.id)

        response = api_key_client.put(url, {str(option_property.id): "DOES-NOT-EXIST"}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_put_list_rejected_for_single_option(self, api_key_client, workspace, project, issue, option_property):
        url = values_url(workspace.slug, project.id, issue.id)

        response = api_key_client.put(url, {str(option_property.id): ["CONNECT", "MOBILITY"]}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_put_invalid_boolean_and_date_rejected(self, api_key_client, workspace, project, issue):
        date_property = IssueProperty.objects.create(
            name="Due Date",
            property_type=PropertyTypeChoices.DATE,
            project=project,
            workspace=project.workspace,
        )
        boolean_property = IssueProperty.objects.create(
            name="Approved",
            property_type=PropertyTypeChoices.BOOLEAN,
            project=project,
            workspace=project.workspace,
        )
        url = values_url(workspace.slug, project.id, issue.id)

        response = api_key_client.put(url, {str(date_property.id): "not-a-date"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        response = api_key_client.put(url, {str(boolean_property.id): "maybe"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_put_unknown_property_id_rejected(self, api_key_client, workspace, project, issue):
        from uuid import uuid4

        url = values_url(workspace.slug, project.id, issue.id)

        response = api_key_client.put(url, {str(uuid4()): "value"}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_put_user_value(self, api_key_client, workspace, project, issue, create_user):
        user_property = IssueProperty.objects.create(
            name="Account Manager",
            property_type=PropertyTypeChoices.USER,
            project=project,
            workspace=project.workspace,
        )
        url = values_url(workspace.slug, project.id, issue.id)

        response = api_key_client.put(url, {str(user_property.id): str(create_user.id)}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["values"][str(user_property.id)] == str(create_user.id)


@pytest.mark.contract
class TestWorkItemPropertyFiltering:
    """Test property filters on the work item list endpoint"""

    @pytest.fixture
    def issues_with_amounts(self, db, project, state, create_user, number_property):
        issues = []
        for index, amount in enumerate([100, 500000, 900000]):
            work_item = Issue.objects.create(
                name=f"Deal {index}",
                project=project,
                workspace=project.workspace,
                state=state,
                created_by=create_user,
            )
            IssuePropertyValue.objects.create(
                issue=work_item,
                property=number_property,
                project=project,
                workspace=project.workspace,
                value_number=Decimal(amount),
            )
            issues.append(work_item)
        return issues

    @pytest.mark.django_db
    def test_number_equality_filter(self, api_key_client, workspace, project, number_property, issues_with_amounts):
        response = api_key_client.get(
            work_items_url(workspace.slug, project.id),
            {f"property__{number_property.id}": "500000"},
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1
        assert response.data["results"][0]["name"] == "Deal 1"

    @pytest.mark.django_db
    def test_number_gt_lt_filters(self, api_key_client, workspace, project, number_property, issues_with_amounts):
        response = api_key_client.get(
            work_items_url(workspace.slug, project.id),
            {f"property__{number_property.id}__gt": "1000"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 2

        response = api_key_client.get(
            work_items_url(workspace.slug, project.id),
            {
                f"property__{number_property.id}__gt": "1000",
                f"property__{number_property.id}__lt": "600000",
            },
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1
        assert response.data["results"][0]["name"] == "Deal 1"

    @pytest.mark.django_db
    def test_gt_filter_rejected_for_non_number(self, api_key_client, workspace, project, option_property):
        response = api_key_client.get(
            work_items_url(workspace.slug, project.id),
            {f"property__{option_property.id}__gt": "10"},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_option_equality_filter(
        self, api_key_client, workspace, project, state, create_user, issue, option_property
    ):
        connect = option_property.options.get(name="CONNECT")
        mobility = option_property.options.get(name="MOBILITY")
        other_issue = Issue.objects.create(
            name="Other Work Item",
            project=project,
            workspace=project.workspace,
            state=state,
            created_by=create_user,
        )
        IssuePropertyValue.objects.create(
            issue=issue,
            property=option_property,
            project=project,
            workspace=project.workspace,
            value_option=connect,
        )
        IssuePropertyValue.objects.create(
            issue=other_issue,
            property=option_property,
            project=project,
            workspace=project.workspace,
            value_option=mobility,
        )

        response = api_key_client.get(
            work_items_url(workspace.slug, project.id),
            {f"property__{option_property.id}": str(connect.id)},
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1
        assert response.data["results"][0]["name"] == issue.name

        # Filtering by option name resolves to the same option
        response = api_key_client.get(
            work_items_url(workspace.slug, project.id),
            {f"property__{option_property.id}": "MOBILITY"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1
        assert response.data["results"][0]["name"] == other_issue.name

    @pytest.mark.django_db
    def test_multi_option_has_filter(
        self, api_key_client, workspace, project, state, create_user, issue, multi_option_property
    ):
        eu_option = multi_option_property.options.get(name="EU")
        us_option = multi_option_property.options.get(name="US")
        for option in [eu_option, us_option]:
            IssuePropertyValue.objects.create(
                issue=issue,
                property=multi_option_property,
                project=project,
                workspace=project.workspace,
                value_option=option,
            )

        response = api_key_client.get(
            work_items_url(workspace.slug, project.id),
            {f"property__{multi_option_property.id}": str(eu_option.id)},
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1

        apac_option = multi_option_property.options.get(name="APAC")
        response = api_key_client.get(
            work_items_url(workspace.slug, project.id),
            {f"property__{multi_option_property.id}": str(apac_option.id)},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 0

    @pytest.mark.django_db
    def test_unknown_property_filter_rejected(self, api_key_client, workspace, project):
        from uuid import uuid4

        response = api_key_client.get(
            work_items_url(workspace.slug, project.id),
            {f"property__{uuid4()}": "10"},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.contract
class TestIssuePropertyTypeScoping:
    """Test scoping a work item property to a specific work item type, and
    the ?issue_type= filter on the list endpoint."""

    @pytest.fixture
    def bug_type(self, db, workspace, project, create_user):
        issue_type = IssueType.objects.create(workspace=workspace, name="Bug", is_epic=False)
        ProjectIssueType.objects.create(project=project, issue_type=issue_type, workspace=workspace)
        return issue_type

    @pytest.fixture
    def story_type(self, db, workspace, project, create_user):
        issue_type = IssueType.objects.create(workspace=workspace, name="Story", is_epic=False)
        ProjectIssueType.objects.create(project=project, issue_type=issue_type, workspace=workspace)
        return issue_type

    @pytest.mark.django_db
    def test_create_property_scoped_to_type(self, api_key_client, workspace, project, bug_type):
        response = api_key_client.post(
            property_url(workspace.slug, project.id),
            {"name": "Severity", "property_type": "TEXT", "issue_type": str(bug_type.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert str(response.data["issue_type"]) == str(bug_type.id)

    @pytest.mark.django_db
    def test_create_property_scoped_to_foreign_type_rejected(self, api_key_client, workspace, project, create_user):
        other_workspace_type = IssueType.objects.create(workspace=workspace, name="Unrelated", is_epic=False)
        # Not linked to `project` via ProjectIssueType, so it's not valid for it

        response = api_key_client.post(
            property_url(workspace.slug, project.id),
            {"name": "Severity", "property_type": "TEXT", "issue_type": str(other_workspace_type.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_list_filter_by_issue_type_includes_unscoped(
        self, api_key_client, workspace, project, bug_type, story_type
    ):
        # Regression guard: with no query param, unscoped properties (the
        # normal case for every property that existed before this feature)
        # are returned exactly as before.
        for index in range(3):
            IssueProperty.objects.create(
                name=f"Unscoped {index}",
                property_type=PropertyTypeChoices.TEXT,
                project=project,
                workspace=project.workspace,
            )
        bug_only = IssueProperty.objects.create(
            name="Bug Only",
            property_type=PropertyTypeChoices.TEXT,
            project=project,
            workspace=project.workspace,
            issue_type=bug_type,
        )
        IssueProperty.objects.create(
            name="Story Only",
            property_type=PropertyTypeChoices.TEXT,
            project=project,
            workspace=project.workspace,
            issue_type=story_type,
        )

        # No query param: unchanged, everything is returned
        response = api_key_client.get(property_url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 5

        # Filtered by bug_type: the 3 unscoped properties + the bug-scoped one
        response = api_key_client.get(
            property_url(workspace.slug, project.id), {"issue_type": str(bug_type.id)}
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 4
        names = {prop["name"] for prop in response.data["results"]}
        assert names == {"Unscoped 0", "Unscoped 1", "Unscoped 2", "Bug Only"}
        assert "Story Only" not in names

        # ?unscoped=true: only the unscoped properties
        response = api_key_client.get(property_url(workspace.slug, project.id), {"unscoped": "true"})
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 3

        assert bug_only.issue_type_id == bug_type.id
