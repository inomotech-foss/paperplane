# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.conf import settings
from django.db import models

from .base import BaseModel


class ApplicationInstallation(BaseModel):
    """A workspace an OAuth application may act in on one user's behalf.

    The rows for (user, application) are what /auth/o/app-installation/ returns
    and what the API checks each request against.
    """

    application = models.ForeignKey(
        "oauth2_provider.Application", on_delete=models.CASCADE, related_name="installations"
    )
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="app_installations")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="app_installations")

    class Meta:
        # deleted_at is in the uniqueness so a revoked row does not block
        # re-consenting; the partial constraint keeps live rows unique.
        unique_together = ["application", "workspace", "user", "deleted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["application", "workspace", "user"],
                condition=models.Q(deleted_at__isnull=True),
                name="app_installation_unique_app_workspace_user_when_not_deleted",
            )
        ]
        verbose_name = "Application Installation"
        verbose_name_plural = "Application Installations"
        db_table = "application_installations"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.application_id} <{self.workspace_id}>"
