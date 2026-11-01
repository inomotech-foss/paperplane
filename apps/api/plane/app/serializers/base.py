# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from functools import cache

from django.db import models
from rest_framework import serializers


# Relations in the expansion mapper that are to-many.
MANY_EXPANSION_FIELDS = frozenset(
    {
        "members",
        "assignees",
        "labels",
        "issue_cycle",
        "issue_relation",
        "issue_intake",
        "issue_reactions",
        "issue_link",
        "sub_issues",
        "issue_related",
    }
)


def get_expansion_mapper():
    """Return the ``expand`` key -> serializer mapping.

    Shared by ``_add_expansion_fields`` and ``to_representation`` so the two cannot drift
    apart -- keeping two copies is how ``updated_by`` came to be added to the
    ``/api/v1/`` mapper and to neither of these (makeplane/plane#4639).

    ``issue_attachment`` is deliberately absent: ``Issue.issue_attachment`` is the
    reverse manager of the legacy ``IssueAttachment`` model, which
    ``IssueAttachmentLiteSerializer`` (``model = FileAsset``) cannot serialize.
    Attachments are served by the ``issue_attachments`` block in
    ``to_representation`` below.

    Imports stay inside the function because the serializers import this module.
    """
    from . import (
        WorkspaceLiteSerializer,
        ProjectLiteSerializer,
        UserLiteSerializer,
        StateLiteSerializer,
        IssueSerializer,
        LabelSerializer,
        CycleIssueSerializer,
        IssueLiteSerializer,
        IssueRelationSerializer,
        IntakeIssueLiteSerializer,
        IssueReactionLiteSerializer,
        IssueLinkLiteSerializer,
        RelatedIssueSerializer,
    )

    return {
        "user": UserLiteSerializer,
        "workspace": WorkspaceLiteSerializer,
        "project": ProjectLiteSerializer,
        "default_assignee": UserLiteSerializer,
        "project_lead": UserLiteSerializer,
        "state": StateLiteSerializer,
        "created_by": UserLiteSerializer,
        "updated_by": UserLiteSerializer,
        "issue": IssueSerializer,
        "actor": UserLiteSerializer,
        "owned_by": UserLiteSerializer,
        "members": UserLiteSerializer,
        "assignees": UserLiteSerializer,
        "labels": LabelSerializer,
        "issue_cycle": CycleIssueSerializer,
        "parent": IssueLiteSerializer,
        "issue_relation": IssueRelationSerializer,
        "issue_intake": IntakeIssueLiteSerializer,
        "issue_related": RelatedIssueSerializer,
        "issue_reactions": IssueReactionLiteSerializer,
        "issue_link": IssueLinkLiteSerializer,
        "sub_issues": IssueLiteSerializer,
    }


@cache
def expandable_keys(model):
    """The ``expand`` keys that name a relation of ``model`` whose target the expansion mapper serializes."""
    from plane.db.models import Issue

    expansion = get_expansion_mapper()
    keys = set()
    for field in model._meta.get_fields():
        # A missing reverse one-to-one row raises on access, so those are left out.
        if not field.is_relation or field.related_model is None or (field.one_to_one and not field.concrete):
            continue
        name = field.get_accessor_name() if field.auto_created and not field.concrete else field.name
        serializer = expansion.get(name)
        if serializer and issubclass(field.related_model, serializer.Meta.model):
            keys.add(name)
    if issubclass(model, Issue):
        keys.add("issue_attachments")
    return frozenset(keys)


class BaseSerializer(serializers.ModelSerializer):
    id = serializers.PrimaryKeyRelatedField(read_only=True)


class DynamicBaseSerializer(BaseSerializer):
    def __init__(self, *args, **kwargs):
        expand = kwargs.pop("expand", []) or []
        super().__init__(*args, **kwargs)
        allowed = expandable_keys(self.Meta.model) if expand else frozenset()
        self.expand = [name for name in expand if name in allowed]
        if self.expand:
            self._add_expansion_fields()

    def _add_expansion_fields(self):
        """Declare a nested serializer for each expanded relation that is not a field yet."""
        expansion = get_expansion_mapper()
        for name in self.expand:
            if name in expansion and name not in self.fields:
                self.fields[name] = expansion[name](many=name in MANY_EXPANSION_FIELDS)

    def to_representation(self, instance):
        response = super().to_representation(instance)
        if not self.expand:
            return response

        expansion = get_expansion_mapper()
        for expand in self.expand:
            if expand not in expansion:
                continue
            related = getattr(instance, expand)
            if isinstance(related, models.Manager):
                response[expand] = expansion[expand](related, many=True).data
            elif isinstance(related, models.Model):
                response[expand] = expansion[expand](related).data
            elif related is None:
                # Serializing None would emit an object built from the nested serializer's defaults.
                response[expand] = None

        if "issue_attachments" in self.expand:
            # Imported here to avoid circular imports
            from plane.db.models import FileAsset
            from . import IssueAttachmentLiteSerializer

            issue_attachments = (
                FileAsset.objects.filter(issue_id=instance.id, entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT)
                if instance.id
                else []
            )
            response["issue_attachments"] = IssueAttachmentLiteSerializer(issue_attachments, many=True).data

        return response
