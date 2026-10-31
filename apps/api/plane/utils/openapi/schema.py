# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import types
import typing

import uritemplate
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


def _returns_none(attribute):
    """Whether a property's return annotation admits None."""
    function = attribute.fget if isinstance(attribute, property) else attribute
    hint = typing.get_type_hints(function).get("return") if callable(function) else None
    return typing.get_origin(hint) in (typing.Union, types.UnionType) and type(None) in typing.get_args(hint)


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
            # Properties and methods: trust the return annotation, else assume a value.
            if not hasattr(model, part):
                return OMITTED
            return MAYBE_NULL if nullable or _returns_none(getattr(model, part)) else ALWAYS
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

    Meta.response_required and Meta.response_optional override the guess for fields a view adds or drops,
    such as queryset annotations.
    """
    always, nullable = _guessed_presence(serializer, field)
    meta = getattr(serializer, "Meta", None)
    if field.field_name in getattr(meta, "response_required", ()):
        always = True
    if field.field_name in getattr(meta, "response_optional", ()):
        always = False
    return always, nullable


def _guessed_presence(serializer, field):
    """DRF skips a field whose attribute is missing unless it is required, has a default or allows null."""
    if field.required or field.default is not empty or field.allow_null:
        return ALWAYS
    if isinstance(field, serializers.SerializerMethodField) or field.source == "*":
        return ALWAYS
    model = getattr(getattr(serializer, "Meta", None), "model", None)
    if model is None:
        return OMITTED
    return _source_presence(model, field.source)


class DetailOrList:
    """Response of an APIView routed on a list and a detail path.

    One `serializer` when the path has `kwarg`, a list of them otherwise. Use it as a value of the responses dict.
    """

    def __init__(self, serializer, kwarg="pk"):
        self.serializer = serializer
        self.kwarg = kwarg

    def resolve(self, path):
        serializer = force_instance(self.serializer)
        if self.kwarg in uritemplate.variables(path):
            return serializer
        return serializers.ListSerializer(child=serializer)


class AutoSchema(SpectacularAutoSchema):
    """Marks response fields as required when DRF always emits them, and nullable when the source can be null.

    The public v1 schema keeps the stock behaviour.
    """

    def _get_response_for_code(self, serializer, status_code, media_types=None, direction="response"):
        if isinstance(serializer, DetailOrList):
            serializer = serializer.resolve(self.path)
        return super()._get_response_for_code(serializer, status_code, media_types, direction)

    def _map_basic_serializer(self, serializer, direction):
        schema = super()._map_basic_serializer(serializer, direction)
        if direction != "response" or self.path.startswith(V1_PATH_PREFIX):
            return schema

        serializer = force_instance(serializer)
        fields = serializer.fields
        required = []
        for name, prop in schema.get("properties", {}).items():
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
