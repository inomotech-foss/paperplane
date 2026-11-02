# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.importers.plane.catalog import COMMERCIAL, FOLDED, INTEGRATION, RUNTIME, SECRET, skip_reason


@pytest.mark.parametrize("table", ["audit_logs", "audit_logs_2031_04", "audit_logs_default"])
def test_partitions_match_by_pattern(table):
    assert skip_reason(table) == RUNTIME


@pytest.mark.parametrize(
    "table, reason",
    [
        ("django_celery_beat_periodictask", RUNTIME),
        ("auth_group", RUNTIME),
        ("sessions", RUNTIME),
        ("oauth_access_tokens", SECRET),
        ("oauth2_provider_grant", SECRET),
        ("mcp_applications", SECRET),
        ("api_tokens", SECRET),
        ("github_repositories", INTEGRATION),
        ("webhooks", INTEGRATION),
        ("milestones", COMMERCIAL),
        ("team_space_members", COMMERCIAL),
        ("initiative_work_items", COMMERCIAL),
        ("issue_property_values", COMMERCIAL),
        ("workflow_transitions", COMMERCIAL),
    ],
)
def test_prefix_families(table, reason):
    assert skip_reason(table) == reason


@pytest.mark.parametrize("table", ["workitem_pages", "work_item_relation_definitions"])
def test_folded_tables(table):
    assert skip_reason(table).startswith(FOLDED)


def test_unknown_returns_none():
    assert skip_reason("brand_new_feature") is None
