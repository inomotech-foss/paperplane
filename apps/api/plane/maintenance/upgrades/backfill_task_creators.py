# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from plane.maintenance.upgrade import DataUpgrade
from plane.maintenance.upgrades.backfill_creators import step

UPGRADE = DataUpgrade(
    name="2026_11_backfill_task_creators",
    description="Fill the creators that Celery tasks and bulk inserts left empty before they recorded the acting "
    "user, the same way as the first creator backfill. A creator that is set is never changed.",
    step=step,
)
