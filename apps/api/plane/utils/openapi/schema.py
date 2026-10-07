# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.core.exceptions import FieldDoesNotExist
from django.db.models import OneToOneRel
from drf_spectacular.openapi import AutoSchema as SpectacularAutoSchema
from drf_spectacular.plumbing import append_meta, force_instance
from rest_framework import serializers
from rest_framework.fields import empty

from .hooks import V1_PATH_PREFIX

ALWAYS = (True, False)
MAYBE_NULL = (True, True)
OMITTED = (False, False)


def _source_presence(model, source):
    """(always emitted, may be null) for a model attribute path, as DRF's get_attribute resolves it.

    A null forward relation in the middle of the path raises AttributeError, so DRF omits the key.
    A missing reverse one-to-one raises ObjectDoesNotExist, which DRF turns into null.
    """
    parts = source.split(".")
    nullable = False
    for index, part in enumerate(parts):
        last = index == len(parts) - 1
        try:
            field = model._meta.get_field(part)
        except FieldDoesNotExist:
            # Properties and methods: assume they return a value.
            if not hasattr(model, part):
                return OMITTED
            return MAYBE_NULL if nullable else ALWAYS
        if isinstance(field, OneToOneRel):
            nullable = True
        elif field.concrete and field.null:
            if not last:
                return OMITTED
            nullable = True
        if last or not field.is_relation or field.many_to_many or field.one_to_many:
            return MAYBE_NULL if nullable else ALWAYS
        model = field.related_model
    return ALWAYS


def serialized_presence(serializer, field):
    """(always emitted, may be null) for a field in to_representation().

    DRF skips a field whose attribute is missing unless it is required, has a default or allows null.
    """
    if field.required or field.default is not empty or field.allow_null:
        return ALWAYS
    if isinstance(field, serializers.SerializerMethodField) or field.source == "*":
        return ALWAYS
    model = getattr(getattr(serializer, "Meta", None), "model", None)
    if model is None:
        return OMITTED
    return _source_presence(model, field.source)


class AutoSchema(SpectacularAutoSchema):
    """Marks response fields as required when DRF always emits them, and nullable when the source can be null.

    The public v1 schema keeps the stock behaviour.
    """

    def _map_basic_serializer(self, serializer, direction):
        schema = super()._map_basic_serializer(serializer, direction)
        if direction != "response" or self.path.startswith(V1_PATH_PREFIX):
            return schema

        serializer = force_instance(serializer)
        fields = serializer.fields
        required = []
        for name, prop in schema["properties"].items():
            always, nullable = serialized_presence(serializer, fields[name])
            if always:
                required.append(name)
            if nullable and not prop.get("nullable"):
                schema["properties"][name] = append_meta(prop, {"nullable": True})
        if required:
            schema["required"] = required
        else:
            schema.pop("required", None)
        return schema
