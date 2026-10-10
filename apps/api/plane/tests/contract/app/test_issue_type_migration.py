# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Moving work items to another type, with the custom property values they carry."""

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import (
    Automation,
    AutomationAction,
    DraftIssue,
    Intake,
    Issue,
    IssueProperty,
    IssuePropertyOption,
    IssuePropertyValue,
    IssueType,
    Project,
    ProjectIssueType,
    ProjectMember,
    WorkspaceMember,
)


@pytest.fixture
def types(db, workspace):
    return {name: IssueType.objects.create(workspace=workspace, name=name) for name in ("Task", "Bug", "Story")}


def make_project(workspace, user, identifier, links):
    project = Project.objects.create(
        name=identifier.title(), identifier=identifier, workspace=workspace, created_by=user
    )
    ProjectMember.objects.create(project=project, member=user, role=20, is_active=True)
    for issue_type in links:
        ProjectIssueType.objects.create(project=project, issue_type=issue_type, workspace=workspace)
    return project


@pytest.fixture
def sales(workspace, create_user, types):
    return make_project(workspace, create_user, "SAL", types.values())


@pytest.fixture
def ops(workspace, create_user, types):
    return make_project(workspace, create_user, "OPS", [types["Task"], types["Story"]])


def make_property(project, name, property_type="TEXT", issue_type=None, options=(), **fields):
    prop = IssueProperty.objects.create(
        workspace_id=project.workspace_id,
        project=project,
        name=name.lower(),
        display_name=name,
        property_type=property_type,
        issue_type=issue_type,
        **fields,
    )
    made = {
        option: IssuePropertyOption.objects.create(
            workspace_id=project.workspace_id, project=project, property=prop, name=option
        )
        for option in options
    }
    return prop, made


def set_value(issue, prop, **value):
    return IssuePropertyValue.objects.create(
        workspace_id=issue.workspace_id, project_id=issue.project_id, issue=issue, property=prop, **value
    )


def make_rows(workspace, project, issue_type):
    """One of every kind of row that can point at a type."""
    rows = {
        "live": Issue.objects.create(name="live", workspace=workspace, project=project, type=issue_type),
        "archived": Issue.objects.create(
            name="archived", workspace=workspace, project=project, type=issue_type, archived_at=timezone.now().date()
        ),
        "deleted": Issue.objects.create(
            name="deleted", workspace=workspace, project=project, type=issue_type, deleted_at=timezone.now()
        ),
        "draft": DraftIssue.objects.create(name="draft", workspace=workspace, project=project, type=issue_type),
        "intake": Intake.objects.create(name="Intake", workspace=workspace, project=project, issue_type=issue_type),
    }
    automation = Automation.objects.create(workspace=workspace, project=project, name="Rule")
    rows["action"] = AutomationAction.objects.create(
        workspace=workspace,
        automation=automation,
        action_type="create_work_item",
        config={"name": "Follow up", "type_id": str(issue_type.id)},
    )
    return rows


def type_of(row):
    current = type(row).all_objects.get(pk=row.pk)
    if isinstance(current, Intake):
        return str(current.issue_type_id)
    if isinstance(current, AutomationAction):
        return current.config["type_id"]
    return str(current.type_id)


def is_linked(project, issue_type):
    return ProjectIssueType.objects.filter(project=project, issue_type=issue_type).exists()


def type_url(workspace, project, issue_type):
    return f"/api/workspaces/{workspace.slug}/projects/{project.id}/issue-types/{issue_type.id}/"


def migrate(client, workspace, project, issue_type, body):
    return client.post(f"{type_url(workspace, project, issue_type)}migrate/", body, format="json")


def migrate_workspace(client, workspace, issue_type, body):
    return client.post(
        f"/api/v1/workspaces/{workspace.slug}/work-item-types/{issue_type.id}/migrate/", body, format="json"
    )


@pytest.fixture
def story_properties(sales, types):
    """Properties of Story alone, and their counterparts on Bug and on every type."""
    size, _ = make_property(sales, "Size", issue_type=types["Story"])
    level, level_options = make_property(sales, "Level", "OPTION", types["Story"], options=("High", "Low"))
    bug_size, _ = make_property(sales, "Bug size", issue_type=types["Bug"])
    severity, severity_options = make_property(sales, "Severity", "OPTION", types["Bug"], options=("High", "Medium"))
    points, _ = make_property(sales, "Points", "DECIMAL", types["Bug"])
    notes, _ = make_property(sales, "Notes")
    return {
        "size": size,
        "level": level,
        "level_options": level_options,
        "bug_size": bug_size,
        "severity": severity,
        "severity_options": severity_options,
        "points": points,
        "notes": notes,
    }


@pytest.fixture
def story(workspace, sales, types, story_properties):
    """A Story with a value in every property it has."""
    item = Issue.objects.create(name="Story one", workspace=workspace, project=sales, type=types["Story"])
    set_value(item, story_properties["size"], value_text="XL")
    set_value(item, story_properties["level"], value_option=story_properties["level_options"]["Low"])
    set_value(item, story_properties["notes"], value_text="kept")
    return item


def values_of(item):
    return {
        (value.property.name, value.value_text or (value.value_option and value.value_option.name))
        for value in IssuePropertyValue.objects.filter(issue=item).select_related("property", "value_option")
    }


@pytest.mark.contract
@pytest.mark.django_db
class TestRemove:
    def test_an_unused_type_is_unlinked(self, session_client, workspace, sales, types):
        response = session_client.delete(type_url(workspace, sales, types["Story"]))

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not is_linked(sales, types["Story"])

    def test_a_used_type_points_at_the_migration(self, session_client, workspace, sales, types):
        Issue.objects.create(
            name="deleted", workspace=workspace, project=sales, type=types["Story"], deleted_at=timezone.now()
        )

        response = session_client.delete(type_url(workspace, sales, types["Story"]))

        assert response.status_code == status.HTTP_409_CONFLICT
        assert response.data["code"] == "type_in_use"
        assert "type migration" in response.data["error"]
        assert is_linked(sales, types["Story"])

    def test_the_workspace_delete_points_at_the_migration(self, api_key_client, workspace, ops, types):
        make_rows(workspace, ops, types["Story"])

        response = api_key_client.delete(f"/api/v1/workspaces/{workspace.slug}/work-item-types/{types['Story'].id}/")

        assert response.status_code == status.HTTP_409_CONFLICT
        assert IssueType.objects.filter(pk=types["Story"].pk).exists()

    def test_the_last_active_type_stays(self, session_client, workspace, create_user, types):
        only = make_project(workspace, create_user, "ONE", [types["Task"]])

        response = session_client.delete(type_url(workspace, only, types["Task"]))

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.contract
@pytest.mark.django_db
class TestUsage:
    def test_counts_rows_and_the_values_that_need_a_decision(self, session_client, workspace, sales, ops, types, story):
        make_rows(workspace, sales, types["Story"])
        make_rows(workspace, ops, types["Story"])

        response = session_client.get(f"{type_url(workspace, sales, types['Story'])}usage/")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["references"] == {
            "work_items": 3,
            "deleted_work_items": 1,
            "drafts": 1,
            "intakes": 1,
            "automation_actions": 1,
        }
        properties = {entry["name"]: entry for entry in response.data["properties"]}
        assert set(properties) == {"Size", "Level"}
        assert properties["Level"]["work_items"] == 1
        assert [(option["name"], option["work_items"]) for option in properties["Level"]["options"]] == [("Low", 1)]


@pytest.mark.contract
@pytest.mark.django_db
class TestScopes:
    def test_work_items_scope_moves_only_those_items(self, session_client, workspace, sales, types):
        rows = make_rows(workspace, sales, types["Story"])
        other = Issue.objects.create(name="other", workspace=workspace, project=sales, type=types["Story"])

        response = migrate(
            session_client,
            workspace,
            sales,
            types["Story"],
            {
                "scope": {"work_items": [str(rows["live"].id), str(rows["deleted"].id)]},
                "replacement_type_id": str(types["Bug"].id),
            },
        )

        assert response.status_code == status.HTTP_200_OK, response.data
        assert type_of(rows["live"]) == type_of(rows["deleted"]) == str(types["Bug"].id)
        assert {type_of(rows[key]) for key in ("archived", "draft", "intake", "action")} == {str(types["Story"].id)}
        assert type_of(other) == str(types["Story"].id)

    def test_project_scope_moves_every_row_of_the_project(self, session_client, workspace, sales, ops, types):
        rows = make_rows(workspace, sales, types["Story"])
        elsewhere = make_rows(workspace, ops, types["Story"])

        response = migrate(
            session_client,
            workspace,
            sales,
            types["Story"],
            {"scope": {"project": str(sales.id)}, "replacement_type_id": str(types["Bug"].id)},
        )

        assert response.status_code == status.HTTP_200_OK, response.data
        assert {type_of(row) for row in rows.values()} == {str(types["Bug"].id)}
        assert {type_of(row) for row in elsewhere.values()} == {str(types["Story"].id)}
        assert is_linked(sales, types["Story"])

    def test_then_unlink_removes_the_type_from_the_project(self, session_client, workspace, sales, types):
        rows = make_rows(workspace, sales, types["Story"])

        response = migrate(
            session_client,
            workspace,
            sales,
            types["Story"],
            {"scope": {"project": str(sales.id)}, "replacement_type_id": str(types["Bug"].id), "then": "unlink"},
        )

        assert response.status_code == status.HTTP_200_OK, response.data
        assert {type_of(row) for row in rows.values()} == {str(types["Bug"].id)}
        assert not is_linked(sales, types["Story"])
        assert not IssueType.objects.filter(pk=types["Story"].pk).exists()

    def test_workspace_scope_moves_rows_of_every_project_and_deletes(
        self, api_key_client, workspace, sales, ops, types
    ):
        rows = [
            *make_rows(workspace, sales, types["Story"]).values(),
            *make_rows(workspace, ops, types["Story"]).values(),
        ]

        response = migrate_workspace(
            api_key_client,
            workspace,
            types["Story"],
            {"scope": {"workspace": True}, "replacement_type_id": str(types["Task"].id), "then": "delete"},
        )

        assert response.status_code == status.HTTP_200_OK, response.data
        assert {type_of(row) for row in rows} == {str(types["Task"].id)}
        assert not IssueType.objects.filter(pk=types["Story"].pk).exists()

    def test_the_public_project_endpoint_migrates_too(self, api_key_client, workspace, sales, types):
        rows = make_rows(workspace, sales, types["Story"])
        url = f"/api/v1/workspaces/{workspace.slug}/projects/{sales.id}/work-item-types/{types['Story'].id}/migrate/"

        response = api_key_client.post(
            url, {"scope": {"project": str(sales.id)}, "replacement_type_id": str(types["Bug"].id)}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK, response.data
        assert {type_of(row) for row in rows.values()} == {str(types["Bug"].id)}

    def test_rows_of_deleted_projects_move_without_a_link(self, api_key_client, workspace, sales, ops, types):
        rows = make_rows(workspace, ops, types["Story"])
        ops.delete()

        response = migrate_workspace(
            api_key_client,
            workspace,
            types["Story"],
            {"scope": {"workspace": True}, "replacement_type_id": str(types["Bug"].id), "then": "delete"},
        )

        assert response.status_code == status.HTTP_200_OK, response.data
        assert type_of(rows["deleted"]) == str(types["Bug"].id)

    def test_dry_run_changes_nothing(self, session_client, workspace, sales, types, story):
        response = migrate(
            session_client,
            workspace,
            sales,
            types["Story"],
            {"scope": {"work_items": [str(story.id)]}, "dry_run": True},
        )

        assert response.status_code == status.HTTP_200_OK
        assert {entry["name"] for entry in response.data["properties"]} == {"Size", "Level"}
        assert type_of(story) == str(types["Story"].id)

    def test_a_scope_without_rows_needs_no_replacement(self, session_client, workspace, sales, types):
        response = migrate(
            session_client, workspace, sales, types["Story"], {"scope": {"project": str(sales.id)}, "then": "unlink"}
        )

        assert response.status_code == status.HTTP_200_OK, response.data
        assert not is_linked(sales, types["Story"])


@pytest.mark.contract
@pytest.mark.django_db
class TestValidation:
    @pytest.mark.parametrize(
        "body,field",
        [
            ({"scope": {"workspace": True}}, "scope"),
            ({"scope": {"project": "11111111-1111-4111-8111-111111111111"}}, "scope"),
            ({"scope": {"work_items": []}}, "scope"),
            ({"scope": {}}, "scope"),
            ({"then": "delete"}, "then"),
            ({"then": "archive"}, "then"),
        ],
    )
    def test_invalid_requests_are_rejected(self, session_client, workspace, sales, types, body, field):
        make_rows(workspace, sales, types["Story"])
        request = {"scope": {"project": str(sales.id)}, "replacement_type_id": str(types["Bug"].id), **body}

        response = migrate(session_client, workspace, sales, types["Story"], request)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert field in response.data

    def test_unlink_needs_the_project_scope(self, api_key_client, workspace, sales, types):
        response = migrate_workspace(
            api_key_client, workspace, types["Story"], {"scope": {"workspace": True}, "then": "unlink"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "then" in response.data

    def test_work_items_of_another_type_are_rejected(self, session_client, workspace, sales, types):
        task = Issue.objects.create(name="task", workspace=workspace, project=sales, type=types["Task"])

        response = migrate(
            session_client,
            workspace,
            sales,
            types["Story"],
            {"scope": {"work_items": [str(task.id)]}, "replacement_type_id": str(types["Bug"].id)},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["scope"] == "Some of the work items are not of the type Story."

    @pytest.mark.parametrize(
        "replacement,message",
        [
            (None, "Work items still use the type Story. Choose a type to move them to."),
            ("Story", "Choose a different type to move the work items to."),
            ("inactive", "The replacement type must be an active type of this workspace."),
            ("epic", "Epics can only move to an epic type, and other work items only to a type that is not an epic."),
            ("unlinked", "The type Unlinked is not enabled in these projects: Sal (SAL)."),
        ],
    )
    def test_an_invalid_replacement_is_rejected(self, session_client, workspace, sales, types, replacement, message):
        rows = make_rows(workspace, sales, types["Story"])
        options = {
            "Story": types["Story"],
            "inactive": IssueType.objects.create(workspace=workspace, name="Old", is_active=False),
            "epic": IssueType.objects.create(workspace=workspace, name="Epic", is_epic=True),
            "unlinked": IssueType.objects.create(workspace=workspace, name="Unlinked"),
        }
        for name in ("inactive", "epic"):
            ProjectIssueType.objects.create(project=sales, issue_type=options[name], workspace=workspace)
        body = {"scope": {"project": str(sales.id)}}
        if replacement:
            body["replacement_type_id"] = str(options[replacement].id)

        response = migrate(session_client, workspace, sales, types["Story"], body)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["replacement_type_id"] == message
        assert type_of(rows["live"]) == str(types["Story"].id)

    def test_a_member_cannot_migrate_the_whole_project(self, session_client, workspace, sales, types, create_user):
        ProjectMember.objects.filter(project=sales, member=create_user).update(role=15)
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=15)

        response = migrate(
            session_client,
            workspace,
            sales,
            types["Story"],
            {"scope": {"project": str(sales.id)}, "replacement_type_id": str(types["Bug"].id)},
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.contract
@pytest.mark.django_db
class TestPropertyMapping:
    def body(self, story, types, mapping):
        return {
            "scope": {"work_items": [str(story.id)]},
            "replacement_type_id": str(types["Bug"].id),
            "property_mapping": mapping,
        }

    def test_every_property_with_values_needs_a_decision(
        self, session_client, workspace, sales, types, story, story_properties
    ):
        response = migrate(session_client, workspace, sales, types["Story"], self.body(story, types, {}))

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert set(response.data["property_mapping"]) == {
            str(story_properties["size"].id),
            str(story_properties["level"].id),
        }
        assert type_of(story) == str(types["Story"].id)

    def test_values_move_to_the_target_and_shared_ones_stay(
        self, session_client, workspace, sales, types, story, story_properties
    ):
        p = story_properties
        mapping = {
            str(p["size"].id): {"target": str(p["bug_size"].id)},
            str(p["level"].id): {
                "target": str(p["severity"].id),
                "options": {str(p["level_options"]["Low"].id): str(p["severity_options"]["Medium"].id)},
            },
        }

        response = migrate(session_client, workspace, sales, types["Story"], self.body(story, types, mapping))

        assert response.status_code == status.HTTP_200_OK, response.data
        assert type_of(story) == str(types["Bug"].id)
        assert values_of(story) == {("bug size", "XL"), ("severity", "Medium"), ("notes", "kept")}

    def test_options_with_the_same_name_map_by_themselves(
        self, session_client, workspace, sales, types, story_properties
    ):
        p = story_properties
        item = Issue.objects.create(name="High one", workspace=workspace, project=sales, type=types["Story"])
        set_value(item, p["level"], value_option=p["level_options"]["High"])
        body = {
            "scope": {"work_items": [str(item.id)]},
            "replacement_type_id": str(types["Bug"].id),
            "property_mapping": {str(p["level"].id): {"target": str(p["severity"].id)}},
        }

        response = migrate(session_client, workspace, sales, types["Story"], body)

        assert response.status_code == status.HTTP_200_OK, response.data
        assert values_of(item) == {("severity", "High")}

    def test_an_unmatched_option_needs_a_decision(
        self, session_client, workspace, sales, types, story, story_properties
    ):
        p = story_properties
        mapping = {str(p["size"].id): {"drop": True}, str(p["level"].id): {"target": str(p["severity"].id)}}

        response = migrate(session_client, workspace, sales, types["Story"], self.body(story, types, mapping))

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["property_mapping"][str(p["level"].id)] == "Choose an option or drop the values for: Low."

    def test_dropping_deletes_the_values(self, session_client, workspace, sales, types, story, story_properties):
        p = story_properties
        mapping = {
            str(p["size"].id): {"drop": True},
            str(p["level"].id): {
                "target": str(p["severity"].id),
                "options": {str(p["level_options"]["Low"].id): None},
            },
        }

        response = migrate(session_client, workspace, sales, types["Story"], self.body(story, types, mapping))

        assert response.status_code == status.HTTP_200_OK, response.data
        assert values_of(story) == {("notes", "kept")}
        assert not IssuePropertyValue.all_objects.filter(property__in=[p["size"], p["level"]]).exists()

    @pytest.mark.parametrize(
        "target,message",
        [
            ("points", "Points cannot hold the values of Size."),
            ("level", "The target property is not available on the new type."),
        ],
    )
    def test_a_target_must_fit(self, session_client, workspace, sales, types, story, story_properties, target, message):
        p = story_properties
        mapping = {str(p["size"].id): {"target": str(p[target].id)}, str(p["level"].id): {"drop": True}}

        response = migrate(session_client, workspace, sales, types["Story"], self.body(story, types, mapping))

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["property_mapping"][str(p["size"].id)] == message

    def test_a_value_the_target_already_has_stays(
        self, session_client, workspace, sales, types, story, story_properties
    ):
        p = story_properties
        set_value(story, p["bug_size"], value_text="S")
        mapping = {str(p["size"].id): {"target": str(p["bug_size"].id)}, str(p["level"].id): {"drop": True}}

        response = migrate(session_client, workspace, sales, types["Story"], self.body(story, types, mapping))

        assert response.status_code == status.HTTP_200_OK, response.data
        assert values_of(story) == {("bug size", "S"), ("notes", "kept")}


@pytest.mark.contract
@pytest.mark.django_db
class TestTypeChangeOnUpdate:
    def test_a_change_that_would_hide_values_is_rejected(
        self, session_client, api_key_client, workspace, sales, types, story
    ):
        app = session_client.patch(
            f"/api/workspaces/{workspace.slug}/projects/{sales.id}/issues/{story.id}/",
            {"type_id": str(types["Bug"].id)},
            format="json",
        )
        public = api_key_client.patch(
            f"/api/v1/workspaces/{workspace.slug}/projects/{sales.id}/work-items/{story.id}/",
            {"type_id": str(types["Bug"].id)},
            format="json",
        )

        for response in (app, public):
            assert response.status_code == status.HTTP_400_BAD_REQUEST
            assert "type migration" in str(response.data["type_id"])
        assert type_of(story) == str(types["Story"].id)

    def test_a_change_that_hides_nothing_goes_through(self, session_client, workspace, sales, types, story_properties):
        item = Issue.objects.create(name="Plain", workspace=workspace, project=sales, type=types["Story"])
        set_value(item, story_properties["notes"], value_text="shared")

        response = session_client.patch(
            f"/api/workspaces/{workspace.slug}/projects/{sales.id}/issues/{item.id}/",
            {"type_id": str(types["Bug"].id)},
            format="json",
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert type_of(item) == str(types["Bug"].id)
