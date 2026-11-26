# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import models


class DataUpgradeState(models.Model):
    """The progress of one data upgrade (see plane.maintenance). Created when it first runs."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        DONE = "done", "Done"
        FAILED = "failed", "Failed"

    name = models.CharField(max_length=100, primary_key=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    cursor = models.JSONField(null=True, blank=True)
    counts = models.JSONField(default=dict, blank=True)
    error = models.TextField(blank=True, default="")
    attempts = models.PositiveIntegerField(default=0)
    # Runs resumed after a worker died, since the last committed batch.
    resumes = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "data_upgrades"
        verbose_name = "Data Upgrade"
        verbose_name_plural = "Data Upgrades"

    def __str__(self) -> str:
        return f"{self.name} ({self.status})"
