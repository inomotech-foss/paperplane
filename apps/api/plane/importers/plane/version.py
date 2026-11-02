# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Which Plane the source is, and whether the importer has seen one like it.

Plane records its schema in ``django_migrations``. CE and Commercial number
the ``db`` app's migrations apart, so the edition (Commercial adds the ``ee``
app) decides which range applies. A source outside the known range is still
imported; the report says so, because a table or column that changed meaning
there would come through without its converter.
"""

import re
from dataclasses import dataclass, field

# db migration heads of the releases the importer is checked against.
CE_OLDEST = (104, "v1.0.0")
CE_NEWEST = (122, "v1.4.3")
COMMERCIAL_NEWEST = (177, "v3.1.5")

_NUMBER = re.compile(r"(\d{4})_")


@dataclass
class SourceVersion:
    edition: str = None
    db_head: int = None
    label: str = None
    warnings: list = field(default_factory=list)


def source_version(source):
    version = SourceVersion()
    apps, heads = set(), []
    for row in source.rows("django_migrations"):
        apps.add(row.get("app"))
        match = _NUMBER.match(row.get("name") or "")
        if row.get("app") == "db" and match:
            heads.append(int(match.group(1)))
    for row in source.rows("instances"):
        version.label = row.get("current_version")

    if not heads:
        version.warnings.append("cannot tell which Plane version the source is: it records no db migrations")
        return version

    version.db_head = max(heads)
    version.edition = "Commercial" if "ee" in apps else "CE"
    head = f"db/{version.db_head:04d}"
    if version.edition == "Commercial":
        newest, release = COMMERCIAL_NEWEST
        if version.db_head > newest:
            version.warnings.append(
                f"the source ({head}) is newer than the newest Plane Commercial the importer knows "
                f"(db/{newest:04d}, {release}); check the report for unknown tables"
            )
        return version

    oldest, oldest_release = CE_OLDEST
    newest, newest_release = CE_NEWEST
    if version.db_head < oldest:
        version.warnings.append(
            f"the source ({head}) is older than Plane CE {oldest_release} (db/{oldest:04d}), the oldest supported"
        )
    elif version.db_head > newest:
        version.warnings.append(
            f"the source ({head}) is newer than the newest Plane CE the importer knows "
            f"(db/{newest:04d}, {newest_release}); check the report for unknown tables"
        )
    return version
