# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The registered data upgrades, in the order they run.

Add new upgrades at the end and never reorder: a later upgrade may depend on
an earlier one.
"""

from plane.maintenance.upgrade import DataUpgrade
from plane.maintenance.upgrades import (
    backfill_creators,
    backfill_task_creators,
    normalise_confluence_tables,
    sanitize_stored_html,
)

UPGRADES: tuple[DataUpgrade, ...] = (
    normalise_confluence_tables.UPGRADE,
    backfill_creators.UPGRADE,
    sanitize_stored_html.UPGRADE,
    backfill_task_creators.UPGRADE,
)
