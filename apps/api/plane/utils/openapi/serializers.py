# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Schema-only serializers for response bodies that views build by hand."""

from drf_spectacular.extensions import OpenApiSerializerExtension
from rest_framework import serializers


class MessageResponseSerializer(serializers.Serializer):
    message = serializers.CharField()


class SlugAvailabilitySerializer(serializers.Serializer):
    status = serializers.BooleanField(help_text="True when the slug is free")


class EmptyObjectSerializer(serializers.Serializer):
    """An object without keys, for responses that return {} in place of an entity."""


class EmptyObjectExtension(OpenApiSerializerExtension):
    target_class = EmptyObjectSerializer

    def map_serializer(self, auto_schema, direction):
        return {"type": "object", "additionalProperties": False}


class DictOf(serializers.Serializer):
    """An object with any keys whose values are `child`. Subclass it and set `child` to a serializer."""

    child = None


class DictOfExtension(OpenApiSerializerExtension):
    target_class = DictOf
    match_subclasses = True

    def map_serializer(self, auto_schema, direction):
        target = self.target if isinstance(self.target, type) else type(self.target)
        child = auto_schema.resolve_serializer(target.child, direction)
        return {"type": "object", "additionalProperties": child.ref}
