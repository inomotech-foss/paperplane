# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.openapi import AutoSchema as SpectacularAutoSchema
from drf_spectacular.plumbing import force_instance
from rest_framework import serializers
from rest_framework.fields import empty

from .hooks import V1_PATH_PREFIX


def is_always_serialized(serializer, field):
    """Whether to_representation() always emits the field.

    DRF skips a field whose attribute is missing unless it is required, has a default or allows null.
    Attributes are only missing for names the model does not define, such as queryset annotations.
    """
    if field.required or field.default is not empty or field.allow_null:
        return True
    if isinstance(field, serializers.SerializerMethodField) or field.source == "*":
        return True
    model = getattr(getattr(serializer, "Meta", None), "model", None)
    return model is not None and hasattr(model, field.source.split(".")[0])


class AutoSchema(SpectacularAutoSchema):
    """Marks response fields as required when DRF always emits them.

    The public v1 schema keeps the stock behaviour.
    """

    def _map_basic_serializer(self, serializer, direction):
        schema = super()._map_basic_serializer(serializer, direction)
        if direction != "response" or self.path.startswith(V1_PATH_PREFIX):
            return schema

        serializer = force_instance(serializer)
        fields = serializer.fields
        required = [name for name in schema["properties"] if is_always_serialized(serializer, fields[name])]
        if required:
            schema["required"] = required
        else:
            schema.pop("required", None)
        return schema
