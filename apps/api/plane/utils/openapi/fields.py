# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Schema-only field types for JSON columns whose shape the backend defines."""

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers


def typed_json(schema):
    """Return a JSONField subclass that behaves like JSONField and documents `schema`.

    Declare it with the kwargs ModelSerializer would build for the model field, so nothing changes at runtime.
    """
    name = getattr(schema, "__name__", type(schema).__name__).removesuffix("Serializer") + "JSONField"
    return extend_schema_field(schema)(type(name, (serializers.JSONField,), {}))
