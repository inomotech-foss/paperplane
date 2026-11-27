# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

AUDIT_FIELDS = ("created_by", "updated_by")


class ReadOnlyAuditFieldsMixin:
    """Never take the creator or updater from a request body. The models record them on save."""

    def get_fields(self):
        fields = super().get_fields()
        for name in AUDIT_FIELDS:
            field = fields.get(name)
            if field is not None:
                field.read_only = True
                field.required = False
        return fields
