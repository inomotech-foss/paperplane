# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The registered data upgrades, in the order they run.

Add new upgrades at the end and never reorder: a later upgrade may depend on
an earlier one.
"""

from plane.maintenance.upgrade import DataUpgrade
from plane.maintenance.upgrades import normalise_confluence_tables

UPGRADES: tuple[DataUpgrade, ...] = (normalise_confluence_tables.UPGRADE,)
