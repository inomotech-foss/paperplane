# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from plane.importers.plane.version import source_version

from .fakes import FakeSource


def migrations(*names, ee=False):
    rows = [{"app": "db", "name": name} for name in names]
    if ee:
        rows.append({"app": "ee", "name": "0001_initial"})
    return rows


def check(tables):
    return source_version(FakeSource(tables))


def test_tested_commercial_has_no_warning():
    version = check(
        {
            "django_migrations": migrations("0001_initial", "0177_artifact_artifactversion", ee=True),
            "instances": [{"current_version": "v3.1.5", "edition": "PLANE_COMMERCIAL"}],
        }
    )
    assert (version.edition, version.db_head, version.label) == ("Commercial", 177, "v3.1.5")
    assert version.warnings == []


def test_newer_commercial_warns():
    version = check({"django_migrations": migrations("0190_something", ee=True)})
    assert len(version.warnings) == 1 and "newer" in version.warnings[0] and "0190" in version.warnings[0]


def test_supported_ce_has_no_warning():
    assert check({"django_migrations": migrations("0104_cycleuserproperties", "0122_alter")}).warnings == []


def test_ce_older_than_v1_warns():
    version = check({"django_migrations": migrations("0099_old")})
    assert version.edition == "CE"
    assert "older" in version.warnings[0]


def test_ce_newer_than_known_warns():
    assert "newer" in check({"django_migrations": migrations("0125_reset")}).warnings[0]


def test_unknown_version_warns():
    assert "cannot tell" in check({}).warnings[0]
