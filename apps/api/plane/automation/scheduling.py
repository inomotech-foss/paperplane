# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Turning a saved schedule into the next UTC instant it should fire.

Two authoring modes, both normalised to cron fields and evaluated in the
automation's own timezone so a "9am daily" rule stays at 9am across DST:

* ``fixed``  - the designer's frequency/day/time pickers
* ``cron``   - a raw five field expression

Celery's ``crontab`` does the parsing (and the validation), we walk forward from
a given instant to find the next match. Day-of-month and day-of-week combine
with OR when both are restricted, matching standard cron.
"""

# Python imports
import calendar
import datetime

# Third party imports
from celery.schedules import crontab

# Django imports
from django.utils import timezone

# Module imports
from plane.automation.context import resolve_timezone

FREQUENCY_DAILY = "daily"
FREQUENCY_WEEKLY = "weekly"
FREQUENCY_MONTHLY = "monthly"
FREQUENCIES = (FREQUENCY_DAILY, FREQUENCY_WEEKLY, FREQUENCY_MONTHLY)

MODE_FIXED = "fixed"
MODE_CRON = "cron"

#: How far ahead to look for a match before giving up. Four years covers even
#: `0 0 29 2 *` (29th of February).
MAX_LOOKAHEAD_DAYS = 1500

ALL_MINUTES = set(range(60))
ALL_HOURS = set(range(24))
ALL_DAYS_OF_MONTH = set(range(1, 32))
ALL_DAYS_OF_WEEK = set(range(7))
ALL_MONTHS = set(range(1, 13))


class ScheduleError(ValueError):
    """Raised when a schedule configuration cannot be interpreted."""


def _normalize_day_of_week(spec: str) -> str:
    """
    Celery rejects ``7`` for Sunday, standard cron accepts it. Rewrite whole
    tokens so ``1-7`` and ``0,7`` keep working.
    """
    tokens = []
    for token in str(spec).split(","):
        token = token.strip()
        if token == "7":
            token = "0"
        elif token.endswith("-7"):
            # `1-7` means Monday through Sunday, i.e. every day.
            token = f"{token[:-2]}-6,0"
        tokens.append(token)
    return ",".join(tokens)


def _parse_cron(expression: str) -> tuple[crontab | None, str | None]:
    """
    Returning counterpart to ``parse_cron``: ``(schedule, None)`` on success,
    ``(None, message)`` otherwise.

    Validation goes through this form rather than catching ``ScheduleError``, so
    the message an API response carries is always one of the literals below and
    never derived from an exception.
    """
    if not expression or not str(expression).strip():
        return None, "The cron expression is empty."

    parts = str(expression).strip().split()
    if len(parts) != 5:
        return None, "A cron expression needs exactly five fields: minute hour day-of-month month day-of-week."

    minute, hour, day_of_month, month_of_year, day_of_week = parts
    try:
        schedule = crontab(
            minute=minute,
            hour=hour,
            day_of_month=day_of_month,
            month_of_year=month_of_year,
            day_of_week=_normalize_day_of_week(day_of_week),
        )
    except (ValueError, KeyError):
        # Deliberately not surfacing the parser's own message: it is third party
        # text on a path that ends in an API response.
        return None, "That cron expression isn't valid. Check each field's range, for example '0 9 * * 1-5'."
    return schedule, None


def _build_fixed(config: dict) -> tuple[crontab | None, str | None]:
    frequency = config.get("frequency") or FREQUENCY_DAILY
    if frequency not in FREQUENCIES:
        return None, "That isn't a supported frequency."

    try:
        hour = int(config.get("hour", 9))
        minute = int(config.get("minute", 0))
    except (TypeError, ValueError):
        return None, "The time of day must be whole numbers."
    if not 0 <= hour <= 23 or not 0 <= minute <= 59:
        return None, "The time of day is out of range."

    day_of_week = "*"
    day_of_month = "*"

    if frequency == FREQUENCY_WEEKLY:
        days = config.get("days_of_week") or []
        if not days:
            return None, "Select at least one day of the week."
        try:
            normalized = sorted({int(day) % 7 for day in days})
        except (TypeError, ValueError):
            return None, "Days of the week must be numbers from 0 (Sunday) to 6 (Saturday)."
        day_of_week = ",".join(str(day) for day in normalized)
    elif frequency == FREQUENCY_MONTHLY:
        try:
            day = int(config.get("day_of_month", 1))
        except (TypeError, ValueError):
            return None, "The day of the month must be a whole number."
        if not 1 <= day <= 31:
            return None, "The day of the month must be between 1 and 31."
        day_of_month = str(day)

    return (
        crontab(
            minute=str(minute),
            hour=str(hour),
            day_of_month=day_of_month,
            month_of_year="*",
            day_of_week=day_of_week,
        ),
        None,
    )


def _build_crontab(trigger_config: dict) -> tuple[crontab | None, str | None]:
    config = trigger_config or {}
    mode = config.get("mode") or MODE_FIXED
    if mode == MODE_CRON:
        return _parse_cron(config.get("cron"))
    if mode == MODE_FIXED:
        return _build_fixed(config)
    return None, "That isn't a supported schedule mode."


def parse_cron(expression: str) -> crontab:
    """Parse a five field cron expression. Raises ``ScheduleError``."""
    schedule, error = _parse_cron(expression)
    if error is not None:
        raise ScheduleError(error)
    return schedule


def to_crontab(trigger_config: dict) -> crontab:
    """Normalise either authoring mode into a parsed cron schedule."""
    schedule, error = _build_crontab(trigger_config)
    if error is not None:
        raise ScheduleError(error)
    return schedule


def _day_matches(date: datetime.date, schedule: crontab) -> bool:
    days_of_month = set(schedule.day_of_month)
    days_of_week = set(schedule.day_of_week)

    dom_restricted = days_of_month != ALL_DAYS_OF_MONTH
    dow_restricted = days_of_week != ALL_DAYS_OF_WEEK

    # cron's weekday numbering puts Sunday at 0; Python's isoweekday puts it at 7.
    weekday = date.isoweekday() % 7

    if dom_restricted and dow_restricted:
        return date.day in days_of_month or weekday in days_of_week
    if dom_restricted:
        return date.day in days_of_month
    if dow_restricted:
        return weekday in days_of_week
    return True


def next_occurrence(trigger_config: dict, after: datetime.datetime | None = None) -> datetime.datetime | None:
    """
    The first UTC instant strictly after ``after`` that the schedule fires.

    Returns ``None`` when nothing matches inside the lookahead window (for
    example ``0 0 30 2 *``, a date that never exists).
    """
    schedule = to_crontab(trigger_config)
    return _first_occurrence(schedule, (trigger_config or {}).get("timezone"), after)


def _first_occurrence(
    schedule: crontab, timezone_name: str | None, after: datetime.datetime | None
) -> datetime.datetime | None:
    tzinfo = resolve_timezone(timezone_name)

    after = after or timezone.now()
    if timezone.is_naive(after):
        after = timezone.make_aware(after, datetime.UTC)
    local_after = after.astimezone(tzinfo)

    # Candidates live on minute boundaries, so the earliest one is the next minute.
    earliest = (local_after + datetime.timedelta(minutes=1)).replace(second=0, microsecond=0)

    hours = sorted(schedule.hour)
    minutes = sorted(schedule.minute)
    months = set(schedule.month_of_year)

    for offset in range(MAX_LOOKAHEAD_DAYS):
        date = earliest.date() + datetime.timedelta(days=offset)
        if date.month not in months:
            continue
        if date.day > calendar.monthrange(date.year, date.month)[1]:
            continue
        if not _day_matches(date, schedule):
            continue

        for hour in hours:
            for minute in minutes:
                naive = datetime.datetime(date.year, date.month, date.day, hour, minute)
                try:
                    candidate = naive.replace(tzinfo=tzinfo)
                except ValueError:
                    continue
                # A DST spring-forward can map a wall clock time onto the hour
                # that never happened; fold=0 resolves it to the later instant.
                if candidate < earliest:
                    continue
                return candidate.astimezone(datetime.UTC)

    return None


def describe(trigger_config: dict) -> str:
    """A short human readable summary, used in API responses and logs."""
    config = trigger_config or {}
    tz_name = config.get("timezone") or "UTC"
    if (config.get("mode") or MODE_FIXED) == MODE_CRON:
        return f"cron '{config.get('cron', '')}' ({tz_name})"

    frequency = config.get("frequency") or FREQUENCY_DAILY
    time_of_day = f"{int(config.get('hour', 9)):02d}:{int(config.get('minute', 0)):02d}"
    if frequency == FREQUENCY_WEEKLY:
        day_names = [calendar.day_name[(int(day) - 1) % 7] for day in config.get("days_of_week") or []]
        return f"weekly on {', '.join(day_names)} at {time_of_day} ({tz_name})"
    if frequency == FREQUENCY_MONTHLY:
        return f"monthly on day {config.get('day_of_month', 1)} at {time_of_day} ({tz_name})"
    return f"daily at {time_of_day} ({tz_name})"


def validate(trigger_config: dict) -> None:
    """Raise ``ScheduleError`` if the schedule cannot be scheduled."""
    if next_occurrence(trigger_config) is None:
        raise ScheduleError("This schedule never comes around. Check the day and month.")


def schedule_error(trigger_config: dict) -> str | None:
    """
    Validation-oriented counterpart to ``validate``: returns a user-facing
    message, or ``None`` when the schedule is usable.

    Callers that serve the message to a client should use this rather than
    catching ``ScheduleError``, so the text is always a literal from this module.
    """
    schedule, error = _build_crontab(trigger_config)
    if error is not None:
        return error
    if _first_occurrence(schedule, (trigger_config or {}).get("timezone"), None) is None:
        return "This schedule never comes around. Check the day and month."
    return None
