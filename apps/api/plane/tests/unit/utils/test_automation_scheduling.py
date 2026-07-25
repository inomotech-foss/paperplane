# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Unit tests for turning a saved schedule into its next fire time."""

import datetime

import pytest

from plane.automation.scheduling import (
    ScheduleError,
    describe,
    next_occurrence,
    parse_cron,
    validate,
)

pytestmark = pytest.mark.unit

# A Friday, midday UTC.
FRIDAY_NOON = datetime.datetime(2026, 7, 24, 12, 0, tzinfo=datetime.UTC)


class TestFixedSchedules:
    def test_daily_picks_the_next_matching_time(self):
        config = {"mode": "fixed", "frequency": "daily", "hour": 23, "minute": 30, "timezone": "UTC"}
        assert next_occurrence(config, after=FRIDAY_NOON) == datetime.datetime(2026, 7, 24, 23, 30, tzinfo=datetime.UTC)

    def test_daily_rolls_over_when_the_time_has_passed(self):
        config = {"mode": "fixed", "frequency": "daily", "hour": 9, "minute": 0, "timezone": "UTC"}
        assert next_occurrence(config, after=FRIDAY_NOON) == datetime.datetime(2026, 7, 25, 9, 0, tzinfo=datetime.UTC)

    def test_time_is_interpreted_in_the_configured_timezone(self):
        config = {"mode": "fixed", "frequency": "daily", "hour": 9, "minute": 0, "timezone": "Europe/Berlin"}
        # Berlin is UTC+2 in July, so 09:00 local is 07:00 UTC.
        assert next_occurrence(config, after=FRIDAY_NOON) == datetime.datetime(2026, 7, 25, 7, 0, tzinfo=datetime.UTC)

    def test_weekly_uses_cron_day_numbering(self):
        # 1 is Monday; the next Monday after Friday 24 July 2026 is the 27th.
        config = {
            "mode": "fixed",
            "frequency": "weekly",
            "days_of_week": [1],
            "hour": 9,
            "minute": 0,
            "timezone": "UTC",
        }
        assert next_occurrence(config, after=FRIDAY_NOON) == datetime.datetime(2026, 7, 27, 9, 0, tzinfo=datetime.UTC)

    def test_weekly_sunday_is_zero(self):
        config = {
            "mode": "fixed",
            "frequency": "weekly",
            "days_of_week": [0],
            "hour": 8,
            "minute": 0,
            "timezone": "UTC",
        }
        assert next_occurrence(config, after=FRIDAY_NOON) == datetime.datetime(2026, 7, 26, 8, 0, tzinfo=datetime.UTC)

    def test_monthly_skips_months_without_the_requested_day(self):
        config = {
            "mode": "fixed",
            "frequency": "monthly",
            "day_of_month": 31,
            "hour": 0,
            "minute": 0,
            "timezone": "UTC",
        }
        # July 31 is still ahead of Friday the 24th.
        assert next_occurrence(config, after=FRIDAY_NOON) == datetime.datetime(2026, 7, 31, 0, 0, tzinfo=datetime.UTC)
        # From August 31 the next 31st is October, since September has 30 days.
        after_august = datetime.datetime(2026, 8, 31, 1, 0, tzinfo=datetime.UTC)
        assert next_occurrence(config, after=after_august) == datetime.datetime(2026, 10, 31, 0, 0, tzinfo=datetime.UTC)

    def test_weekly_without_days_is_rejected(self):
        config = {"mode": "fixed", "frequency": "weekly", "days_of_week": [], "hour": 9, "minute": 0}
        with pytest.raises(ScheduleError, match="at least one day"):
            next_occurrence(config, after=FRIDAY_NOON)

    def test_out_of_range_time_is_rejected(self):
        config = {"mode": "fixed", "frequency": "daily", "hour": 25, "minute": 0}
        with pytest.raises(ScheduleError, match="out of range"):
            next_occurrence(config, after=FRIDAY_NOON)

    def test_unknown_frequency_is_rejected(self):
        with pytest.raises(ScheduleError, match="not a supported frequency"):
            next_occurrence({"mode": "fixed", "frequency": "fortnightly"}, after=FRIDAY_NOON)


class TestCronSchedules:
    def test_weekday_expression(self):
        config = {"mode": "cron", "cron": "0 9 * * 1-5", "timezone": "UTC"}
        assert next_occurrence(config, after=FRIDAY_NOON) == datetime.datetime(2026, 7, 27, 9, 0, tzinfo=datetime.UTC)

    def test_step_expression(self):
        config = {"mode": "cron", "cron": "*/15 * * * *", "timezone": "UTC"}
        assert next_occurrence(config, after=FRIDAY_NOON) == datetime.datetime(2026, 7, 24, 12, 15, tzinfo=datetime.UTC)

    def test_seven_is_accepted_as_sunday(self):
        # Standard cron allows 7 for Sunday even though celery's parser does not.
        config = {"mode": "cron", "cron": "0 8 * * 7", "timezone": "UTC"}
        assert next_occurrence(config, after=FRIDAY_NOON) == datetime.datetime(2026, 7, 26, 8, 0, tzinfo=datetime.UTC)

    def test_day_of_month_and_day_of_week_combine_with_or(self):
        # Standard cron semantics: the 1st of the month OR any Monday.
        config = {"mode": "cron", "cron": "0 0 1 * 1", "timezone": "UTC"}
        assert next_occurrence(config, after=FRIDAY_NOON) == datetime.datetime(2026, 7, 27, 0, 0, tzinfo=datetime.UTC)

    def test_leap_day_looks_years_ahead(self):
        config = {"mode": "cron", "cron": "0 0 29 2 *", "timezone": "UTC"}
        assert next_occurrence(config, after=FRIDAY_NOON) == datetime.datetime(2028, 2, 29, 0, 0, tzinfo=datetime.UTC)

    def test_impossible_date_never_fires(self):
        config = {"mode": "cron", "cron": "0 0 30 2 *", "timezone": "UTC"}
        assert next_occurrence(config, after=FRIDAY_NOON) is None
        with pytest.raises(ScheduleError, match="never comes around"):
            validate(config)

    @pytest.mark.parametrize("expression", ["", "0 9 * *", "0 9 * * * *", "bogus", "99 * * * *"])
    def test_malformed_expressions_are_rejected(self, expression):
        with pytest.raises(ScheduleError):
            parse_cron(expression)


class TestDescribe:
    def test_daily(self):
        config = {"mode": "fixed", "frequency": "daily", "hour": 9, "minute": 5, "timezone": "UTC"}
        assert describe(config) == "daily at 09:05 (UTC)"

    def test_weekly_names_the_days(self):
        config = {
            "mode": "fixed",
            "frequency": "weekly",
            "days_of_week": [1, 0],
            "hour": 9,
            "minute": 0,
            "timezone": "UTC",
        }
        assert describe(config) == "weekly on Monday, Sunday at 09:00 (UTC)"

    def test_cron(self):
        config = {"mode": "cron", "cron": "0 9 * * 1", "timezone": "Europe/Berlin"}
        assert describe(config) == "cron '0 9 * * 1' (Europe/Berlin)"


class TestTimezoneFallback:
    def test_unknown_timezone_falls_back_to_utc(self):
        config = {"mode": "fixed", "frequency": "daily", "hour": 9, "minute": 0, "timezone": "Mars/Olympus"}
        assert next_occurrence(config, after=FRIDAY_NOON) == datetime.datetime(2026, 7, 25, 9, 0, tzinfo=datetime.UTC)

    def test_naive_after_is_treated_as_utc(self):
        config = {"mode": "fixed", "frequency": "daily", "hour": 23, "minute": 0, "timezone": "UTC"}
        naive = datetime.datetime(2026, 7, 24, 12, 0)
        assert next_occurrence(config, after=naive) == datetime.datetime(2026, 7, 24, 23, 0, tzinfo=datetime.UTC)
