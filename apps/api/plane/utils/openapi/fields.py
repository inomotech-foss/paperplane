# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Schema-only field types for JSON columns.

`typed_json` documents a column whose shape the backend defines. `ClientJsonField` documents a column the client
owns: the backend stores it as sent, so the schema promises nothing but an object.
"""

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

CLIENT_JSON_DESCRIPTION = "Stored as sent by the client. The backend does not validate it."

# Model JSON columns the web app writes and reads back. AutoSchema documents them as ClientJson by name.
CLIENT_JSON_FIELDS = frozenset(
    {
        "colors",
        "default_props",
        "display_filters",
        "display_properties",
        "explored_features",
        "filters",
        "getting_started_checklist",
        "goals",
        "icon_prop",
        "issue_props",
        "logo_props",
        "preferences",
        "rich_filters",
        "theme",
        "tips",
        "view_props",
    }
)


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
    return type(field) is serializers.JSONField and field.field_name in CLIENT_JSON_FIELDS


def as_client_json(field):
    """A ClientJsonField with the flags of `field` that the schema reads."""
    return ClientJsonField(
        read_only=field.read_only,
        required=field.required,
        allow_null=field.allow_null,
        help_text=field.help_text,
    )
