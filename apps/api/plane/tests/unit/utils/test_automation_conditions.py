# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Unit tests for automation condition evaluation, with a stub context."""

import datetime
import uuid

import pytest

from plane.automation import conditions
from plane.automation.context import changes_from_activities
from plane.automation.validators import action_error, condition_error, trigger_error

pytestmark = pytest.mark.unit

TODAY = datetime.date(2026, 7, 24)


class StubContext:
    """Minimal stand-in for AutomationContext: a dict of properties + changes."""

    def __init__(self, properties=None, changes=None, today=TODAY):
        self._properties = properties or {}
        self.changes = changes or {}
        self.today = today

    def get(self, property_key):
        return self._properties.get(property_key)


def condition(property_key, operator, value=None):
    return {"type": "condition", "property": property_key, "operator": operator, "value": value}


def group(logical_operator, *children):
    return {"type": "group", "logical_operator": logical_operator, "children": list(children)}


class TestEmptyAndMalformed:
    def test_no_condition_matches_everything(self):
        assert conditions.evaluate(None, StubContext()) is True

    def test_empty_group_matches_everything(self):
        assert conditions.evaluate(group("and"), StubContext()) is True

    def test_unknown_operator_fails_closed(self):
        assert conditions.evaluate(condition("priority", "sideways", "high"), StubContext()) is False

    def test_missing_property_fails_closed(self):
        assert conditions.evaluate({"type": "condition", "operator": "eq"}, StubContext()) is False

    def test_non_dict_fails_closed(self):
        assert conditions.evaluate(["not", "a", "tree"], StubContext()) is False

    def test_unknown_node_type_fails_closed(self):
        assert conditions.evaluate({"type": "loop", "children": []}, StubContext()) is False


class TestScalarOperators:
    def test_in_matches_scalar(self):
        context = StubContext({"priority": "high"})
        assert conditions.evaluate(condition("priority", "in", ["high", "urgent"]), context) is True
        assert conditions.evaluate(condition("priority", "in", ["low"]), context) is False

    def test_not_in_is_the_negation(self):
        context = StubContext({"priority": "high"})
        assert conditions.evaluate(condition("priority", "not_in", ["low"]), context) is True

    def test_uuid_and_string_ids_compare_equal(self):
        state_id = uuid.uuid4()
        context = StubContext({"state_id": state_id})
        assert conditions.evaluate(condition("state_id", "in", [str(state_id)]), context) is True

    def test_eq_and_neq(self):
        context = StubContext({"name": "Fix the thing"})
        assert conditions.evaluate(condition("name", "eq", "Fix the thing"), context) is True
        assert conditions.evaluate(condition("name", "neq", "Fix the thing"), context) is False

    def test_boolean_eq(self):
        assert conditions.evaluate(condition("is_archived", "eq", True), StubContext({"is_archived": True})) is True
        assert conditions.evaluate(condition("is_archived", "eq", False), StubContext({"is_archived": True})) is False

    def test_numeric_comparison(self):
        context = StubContext({"sub_work_item_count": 3})
        assert conditions.evaluate(condition("sub_work_item_count", "gt", 2), context) is True
        assert conditions.evaluate(condition("sub_work_item_count", "lte", 3), context) is True
        assert conditions.evaluate(condition("sub_work_item_count", "lt", 3), context) is False


class TestTextOperators:
    def test_contains_is_case_insensitive(self):
        context = StubContext({"name": "Fix the LOGIN bug"})
        assert conditions.evaluate(condition("name", "contains", "login"), context) is True
        assert conditions.evaluate(condition("name", "not_contains", "login"), context) is False

    def test_contains_matches_any_of_several_needles(self):
        context = StubContext({"name": "Deploy hotfix"})
        assert conditions.evaluate(condition("name", "contains", ["urgent", "hotfix"]), context) is True

    def test_is_empty_and_is_not_empty(self):
        assert conditions.evaluate(condition("description", "is_empty"), StubContext({"description": ""})) is True
        assert conditions.evaluate(condition("description", "is_empty"), StubContext({"description": None})) is True
        assert conditions.evaluate(condition("description", "is_not_empty"), StubContext({"description": "x"})) is True


class TestCollectionOperators:
    def test_contains_is_intersection_for_lists(self):
        member = uuid.uuid4()
        other = uuid.uuid4()
        context = StubContext({"assignee_ids": [member]})
        assert conditions.evaluate(condition("assignee_ids", "contains", [str(member)]), context) is True
        assert conditions.evaluate(condition("assignee_ids", "contains", [str(other)]), context) is False

    def test_empty_list_is_empty(self):
        assert conditions.evaluate(condition("assignee_ids", "is_empty"), StubContext({"assignee_ids": []})) is True
        assert (
            conditions.evaluate(condition("label_ids", "is_not_empty"), StubContext({"label_ids": [uuid.uuid4()]}))
            is True
        )

    def test_in_matches_any_member_of_a_list_property(self):
        label = uuid.uuid4()
        context = StubContext({"label_ids": [label, uuid.uuid4()]})
        assert conditions.evaluate(condition("label_ids", "in", [str(label)]), context) is True


class TestDateOperators:
    def test_overdue_by_days_needs_at_least_that_many_days(self):
        context = StubContext({"target_date": datetime.date(2026, 7, 20)})  # four days ago
        assert conditions.evaluate(condition("target_date", "overdue_by_days", 3), context) is True
        assert conditions.evaluate(condition("target_date", "overdue_by_days", 5), context) is False

    def test_due_in_days_excludes_already_overdue(self):
        upcoming = StubContext({"target_date": datetime.date(2026, 7, 26)})
        overdue = StubContext({"target_date": datetime.date(2026, 7, 20)})
        assert conditions.evaluate(condition("target_date", "due_in_days", 3), upcoming) is True
        assert conditions.evaluate(condition("target_date", "due_in_days", 3), overdue) is False

    def test_due_in_days_includes_today(self):
        context = StubContext({"target_date": TODAY})
        assert conditions.evaluate(condition("target_date", "due_in_days", 0), context) is True

    def test_older_than_days_on_a_timestamp(self):
        context = StubContext({"updated_at": datetime.datetime(2026, 6, 1, 9, 0, tzinfo=datetime.UTC)})
        assert conditions.evaluate(condition("updated_at", "older_than_days", 30), context) is True
        assert conditions.evaluate(condition("updated_at", "older_than_days", 90), context) is False

    def test_iso_strings_are_accepted(self):
        context = StubContext({"target_date": "2026-07-20"})
        assert conditions.evaluate(condition("target_date", "overdue_by_days", 3), context) is True

    def test_missing_date_never_matches_a_relative_operator(self):
        context = StubContext({"target_date": None})
        assert conditions.evaluate(condition("target_date", "overdue_by_days", 1), context) is False

    def test_absolute_comparison(self):
        context = StubContext({"target_date": datetime.date(2026, 7, 20)})
        assert conditions.evaluate(condition("target_date", "lt", "2026-07-24"), context) is True
        assert conditions.evaluate(condition("target_date", "gt", "2026-07-24"), context) is False


class TestChangeOperators:
    def test_changed_needs_the_field_in_the_change_set(self):
        context = StubContext(changes={"priority": {"old": ["low"], "new": ["high"]}})
        assert conditions.evaluate(condition("priority", "changed"), context) is True
        assert conditions.evaluate(condition("state_id", "changed"), context) is False

    def test_changed_to_and_changed_from(self):
        context = StubContext(changes={"priority": {"old": ["low"], "new": ["high"]}})
        assert conditions.evaluate(condition("priority", "changed_to", ["high"]), context) is True
        assert conditions.evaluate(condition("priority", "changed_to", ["low"]), context) is False
        assert conditions.evaluate(condition("priority", "changed_from", ["low"]), context) is True

    def test_change_operators_ignore_the_current_value(self):
        # A scheduled run has no change set, so change operators cannot match.
        context = StubContext({"priority": "high"}, changes={})
        assert conditions.evaluate(condition("priority", "changed_to", ["high"]), context) is False


class TestLogicalCombination:
    def test_and_requires_every_child(self):
        context = StubContext({"priority": "high", "state_group": "started"})
        tree = group("and", condition("priority", "in", ["high"]), condition("state_group", "in", ["started"]))
        assert conditions.evaluate(tree, context) is True

        tree = group("and", condition("priority", "in", ["high"]), condition("state_group", "in", ["completed"]))
        assert conditions.evaluate(tree, context) is False

    def test_or_requires_one_child(self):
        context = StubContext({"priority": "high", "state_group": "started"})
        tree = group("or", condition("priority", "in", ["low"]), condition("state_group", "in", ["started"]))
        assert conditions.evaluate(tree, context) is True

    def test_nested_groups(self):
        context = StubContext({"priority": "high", "state_group": "started", "assignee_ids": []})
        tree = group(
            "and",
            condition("state_group", "in", ["started"]),
            group("or", condition("priority", "in", ["urgent"]), condition("assignee_ids", "is_empty")),
        )
        assert conditions.evaluate(tree, context) is True


class TestHelpers:
    def test_collect_properties_walks_the_tree(self):
        tree = group(
            "and",
            condition("priority", "in", ["high"]),
            group("or", condition("state_group", "in", ["started"]), condition("target_date", "is_empty")),
        )
        assert conditions.collect_properties(tree) == {"priority", "state_group", "target_date"}

    def test_uses_change_operators_detects_nested_use(self):
        assert conditions.uses_change_operators(group("and", condition("priority", "changed"))) is True
        assert conditions.uses_change_operators(group("and", condition("priority", "in", ["high"]))) is False


class TestChangesFromActivities:
    def test_folds_identifiers_and_values(self):
        old_state, new_state = uuid.uuid4(), uuid.uuid4()
        activities = [
            {"field": "state", "old_identifier": str(old_state), "new_identifier": str(new_state)},
            {"field": "priority", "old_value": "low", "new_value": "high"},
        ]
        changes = changes_from_activities(activities)
        assert changes["state_id"] == {"old": [str(old_state)], "new": [str(new_state)]}
        assert changes["priority"] == {"old": ["low"], "new": ["high"]}

    def test_multi_value_fields_accumulate(self):
        first, second = uuid.uuid4(), uuid.uuid4()
        activities = [
            {"field": "labels", "old_value": "", "new_value": "bug", "new_identifier": str(first)},
            {"field": "labels", "old_value": "", "new_value": "urgent", "new_identifier": str(second)},
        ]
        changes = changes_from_activities(activities)
        assert set(changes["label_ids"]["new"]) == {str(first), str(second)}

    def test_activities_without_a_field_are_ignored(self):
        assert changes_from_activities([{"field": None, "new_value": "x"}]) == {}

    def test_none_is_tolerated(self):
        assert changes_from_activities(None) == {}


class TestConditionValidation:
    """
    Validation returns a message instead of raising: the serializer hands these
    straight to an API response, so the text must be a literal we authored rather
    than a stringified exception.
    """

    def test_valid_tree_returns_none(self):
        assert condition_error(group("and", condition("priority", "in", ["high"]))) is None

    def test_none_is_valid(self):
        assert condition_error(None) is None

    def test_unknown_property_is_rejected(self):
        assert condition_error(condition("colour", "in", ["red"])) == (
            "That isn't a property you can build a condition on."
        )

    def test_operator_must_be_allowed_for_the_property(self):
        message = condition_error(condition("priority", "older_than_days", 3))
        assert message == "That comparison can't be used with the selected property."

    def test_unknown_logical_operator_is_rejected(self):
        message = condition_error(group("xor", condition("priority", "in", ["high"])))
        assert message == "That isn't a supported way to combine conditions."

    def test_excessive_nesting_is_rejected(self):
        tree = condition("priority", "in", ["high"])
        for _ in range(10):
            tree = group("and", tree)
        assert condition_error(tree) == "The condition is nested too deeply."

    def test_a_nested_problem_surfaces(self):
        tree = group("and", condition("priority", "in", ["high"]), group("or", condition("colour", "in", ["red"])))
        assert condition_error(tree) == "That isn't a property you can build a condition on."


class TestTriggerValidation:
    def test_empty_trigger_is_a_valid_draft(self):
        assert trigger_error("", {}) is None

    def test_unknown_trigger_is_rejected(self):
        assert trigger_error("work_item.exploded", {}) == "That isn't a supported trigger."

    def test_event_trigger_ignores_schedule_config(self):
        assert trigger_error("work_item.created", {}) is None

    def test_schedule_trigger_validates_the_schedule(self):
        assert trigger_error("schedule", {"mode": "fixed", "frequency": "daily", "hour": 9, "minute": 0}) is None
        assert trigger_error("schedule", {"mode": "cron", "cron": "nope"}) is not None

    def test_schedule_message_does_not_leak_the_parser_text(self):
        # The celery parser says things like "Invalid end range: 7 > 6"; that is
        # third-party text on a path that ends in an API response.
        message = trigger_error("schedule", {"mode": "cron", "cron": "* * * * 9"})
        assert message is not None
        assert "range" not in message.lower() or "each field" in message.lower()


class TestActionValidation:
    def test_unknown_action_is_rejected(self):
        assert action_error("launch_rocket", {}) == "That isn't a supported action."

    def test_archive_needs_no_config(self):
        assert action_error("archive_work_item", {}) is None

    def test_change_property_requires_a_value(self):
        message = action_error("change_property", {"property": "priority", "change_type": "set"})
        assert message == "Pick a value for the property you're changing."

    def test_change_property_clear_needs_no_value(self):
        assert action_error("change_property", {"property": "target_date", "change_type": "clear"}) is None

    def test_notification_requires_recipients(self):
        assert action_error("send_notification", {"title": "Hi"}) == "Choose at least one recipient."

    def test_notification_rejects_an_unknown_group(self):
        message = action_error("send_notification", {"recipients": ["everyone"], "title": "Hi"})
        assert message == "One of the chosen recipient groups isn't recognised."

    def test_webhook_requires_an_http_url(self):
        assert action_error("call_webhook", {"url": "ftp://example.com"}) == (
            "The webhook URL must start with http:// or https://."
        )

    def test_create_work_item_requires_a_name(self):
        assert action_error("create_work_item", {"name": "  "}) == "The new work item needs a name."

    def test_create_work_item_rejects_a_malformed_id(self):
        message = action_error("create_work_item", {"name": "Follow up", "state_id": "not-a-uuid"})
        assert message == "The chosen state isn't a valid id."
