# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Schema-only field types for JSON columns.

`typed_json` documents a column whose shape the backend defines. `ClientJsonField` documents a column the client
owns: the backend stores it without validating it, so the schema promises nothing but an object.
"""

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

CLIENT_JSON_DESCRIPTION = (
    "Owned by the client. The backend stores it without validating it, as sent or shallow-merged into the stored value."
)

# A body that is one client-owned object as a whole.
CLIENT_JSON_REF = {"$ref": "#/components/schemas/ClientJson"}

# The JSON fields the web app owns, by the serializer that declares them. Subclasses inherit the marking.
CLIENT_JSON_FIELDS = {
    "plane.app.serializers.cycle.CycleSerializer": {"logo_props", "view_props"},
    "plane.app.serializers.cycle.CycleUserPropertiesSerializer": {
        "display_filters",
        "display_properties",
        "filters",
        "rich_filters",
    },
    "plane.app.serializers.dashboard.DashboardSerializer": {"logo_props"},
    "plane.app.serializers.favorite.CycleFavoriteLiteSerializer": {"logo_props"},
    "plane.app.serializers.favorite.ModuleFavoriteLiteSerializer": {"logo_props"},
    "plane.app.serializers.favorite.PageFavoriteLiteSerializer": {"logo_props"},
    "plane.app.serializers.favorite.ProjectFavoriteLiteSerializer": {"logo_props"},
    "plane.app.serializers.favorite.ViewFavoriteSerializer": {"logo_props"},
    "plane.app.serializers.intake.IntakeSerializer": {"logo_props", "view_props"},
    "plane.app.serializers.issue.ProjectUserPropertySerializer": {
        "display_filters",
        "display_properties",
        "filters",
        "preferences",
        "rich_filters",
    },
    "plane.app.serializers.issue_type.IssueTypeSerializer": {"logo_props"},
    "plane.app.serializers.module.ModuleFlatSerializer": {"logo_props", "view_props"},
    "plane.app.serializers.module.ModuleSerializer": {"logo_props", "view_props"},
    "plane.app.serializers.module.ModuleUserPropertiesSerializer": {
        "display_filters",
        "display_properties",
        "filters",
        "rich_filters",
    },
    "plane.app.serializers.module.ModuleWriteSerializer": {"logo_props", "view_props"},
    "plane.app.serializers.page.PageSerializer": {"logo_props", "view_props"},
    "plane.app.serializers.project.ProjectListSerializer": {"icon_prop", "logo_props"},
    "plane.app.serializers.project.ProjectLiteSerializer": {"logo_props"},
    "plane.app.serializers.project.ProjectMemberPreferenceSerializer": {"preferences"},
    "plane.app.serializers.project.ProjectMemberSerializer": {"default_props", "preferences", "view_props"},
    "plane.app.serializers.project.ProjectSerializer": {"icon_prop", "logo_props"},
    "plane.app.serializers.request.workspace.WorkspaceMemberViewPropsSerializer": {"view_props"},
    "plane.app.serializers.response.cycle.ArchivedCycleDetailSerializer": {"logo_props", "view_props"},
    "plane.app.serializers.response.cycle.ArchivedCycleListItemSerializer": {"view_props"},
    "plane.app.serializers.response.cycle.CycleSnapshotSerializer": {"logo_props", "view_props"},
    "plane.app.serializers.response.dashboard.DashboardTypeSerializer": {"logo_props"},
    "plane.app.serializers.response.module.ArchivedModuleListItemSerializer": {"view_props"},
    "plane.app.serializers.response.module.ModuleListItemSerializer": {"logo_props", "view_props"},
    "plane.app.serializers.response.page.PageQueryRowSerializer": {"logo_props"},
    "plane.app.serializers.response.project.ProjectListItemSerializer": {"logo_props"},
    "plane.app.serializers.response.project.ProjectMemberAdminDetailSerializer": {
        "default_props",
        "preferences",
        "view_props",
    },
    "plane.app.serializers.response.project.ProjectMemberPreferencesSerializer": {"preferences"},
    "plane.app.serializers.response.project.UnpublishedDeployBoardSerializer": {"view_props"},
    "plane.app.serializers.response.public.PublicProjectMetaSerializer": {"icon_prop"},
    "plane.app.serializers.response.search.EntitySearchPageSerializer": {"logo_props"},
    "plane.app.serializers.response.search.EntitySearchProjectSerializer": {"logo_props"},
    "plane.app.serializers.response.workspace.UserProjectIssueCountsSerializer": {"logo_props"},
    "plane.app.serializers.user.ProfileSerializer": {"goals", "theme"},
    "plane.app.serializers.view.IssueViewSerializer": {
        "display_filters",
        "display_properties",
        "filters",
        "logo_props",
        "rich_filters",
    },
    "plane.app.serializers.workspace.PageRecentVisitSerializer": {"logo_props"},
    "plane.app.serializers.workspace.ProjectRecentVisitSerializer": {"logo_props"},
    "plane.app.serializers.workspace.StickySerializer": {"logo_props"},
    "plane.app.serializers.workspace.WorkSpaceMemberSerializer": {
        "default_props",
        "explored_features",
        "getting_started_checklist",
        "issue_props",
        "tips",
        "view_props",
    },
    "plane.app.serializers.workspace.WorkspaceMemberMeSerializer": {
        "default_props",
        "explored_features",
        "getting_started_checklist",
        "issue_props",
        "tips",
        "view_props",
    },
    "plane.app.serializers.workspace.WorkspaceThemeSerializer": {"colors"},
    "plane.app.serializers.workspace.WorkspaceUserPropertiesSerializer": {
        "display_filters",
        "display_properties",
        "filters",
        "rich_filters",
    },
}


def typed_json(schema):
    """Return a JSONField subclass that behaves like JSONField and documents `schema`.

    Declare it with the kwargs ModelSerializer would build for the model field, so nothing changes at runtime.
    """
    name = getattr(schema, "__name__", type(schema).__name__).removesuffix("Serializer") + "JSONField"
    return extend_schema_field(schema)(type(name, (serializers.JSONField,), {}))


@extend_schema_field(
    {
        "type": "object",
        "additionalProperties": True,
        "description": CLIENT_JSON_DESCRIPTION,
        "x-client-owned": True,
    },
    component_name="ClientJson",
)
class ClientJsonField(serializers.JSONField):
    """A JSONField the client owns. Behaves like JSONField."""


def is_client_json(field):
    """Whether the schema documents `field` as ClientJson."""
    if isinstance(field, ClientJsonField):
        return True
    if type(field) is not serializers.JSONField:
        return False
    parent = getattr(field.parent, "child", field.parent)
    return any(
        field.field_name in CLIENT_JSON_FIELDS.get(f"{cls.__module__}.{cls.__qualname__}", ())
        for cls in type(parent).__mro__
    )


def as_client_json(field):
    """A ClientJsonField with the flags of `field` that the schema reads."""
    return ClientJsonField(
        read_only=field.read_only,
        required=field.required,
        allow_null=field.allow_null,
        help_text=field.help_text,
    )
