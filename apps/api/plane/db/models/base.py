# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

# Django imports
from django.db import models

# Third party imports
from crum import get_current_user

# Module imports
from ..mixins import AuditModel


def current_user_id():
    user = get_current_user()
    if user is None or user.is_anonymous:
        return None
    return user.id


class BaseModel(AuditModel):
    id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True, primary_key=True)

    class Meta:
        abstract = True

    def save(self, *args, created_by_id=None, disable_auto_set_user=False, **kwargs):
        user_id = None if disable_auto_set_user else current_user_id()
        if self._state.adding:
            if created_by_id or user_id:
                self.created_by_id = created_by_id or user_id
            if self.updated_by_id is None:
                self.updated_by_id = self.created_by_id
        elif user_id:
            self.updated_by_id = user_id

        super(BaseModel, self).save(*args, **kwargs)

    def __str__(self):
        return str(self.id)
