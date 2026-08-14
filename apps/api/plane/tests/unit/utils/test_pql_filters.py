# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Unit tests for the structured `filters` compiler.

The compiler walks a JSON AST into a Django `Q`, so no database is needed.
The security-relevant assertions are the rejection tables: nothing outside the
field and lookup allowlists may reach `.filter()`.
"""

import uuid
from datetime import date

import pytest
from django.db.models import Q

from plane.utils.pql import FILTER_FIELDS, FilterCompileError, compile_filters
from plane.utils.pql.filters import MAX_FILTER_DEPTH, CustomPropertyFilter

STATE_ID = "11111111-1111-4111-8111-111111111111"
PROJECT_ID = "22222222-2222-4222-8222-222222222222"
TYPE_ID = "33333333-3333-4333-8333-333333333333"
LABEL_ID = "44444444-4444-4444-8444-444444444444"
ASSIGNEE_ID = "55555555-5555-4555-8555-555555555555"
MODULE_ID = "66666666-6666-4666-8666-666666666666"
CYCLE_ID = "77777777-7777-4777-8777-777777777777"
USER_ID = "88888888-8888-4888-8888-888888888888"
PROPERTY_ID = "99999999-9999-4999-8999-999999999999"
PARENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

FIELD_CASES = [
    ({"state_id": STATE_ID}, Q(state_id=uuid.UUID(STATE_ID))),
    ({"state__group": "started"}, Q(state__group="started")),
    ({"priority": "urgent"}, Q(priority="urgent")),
    ({"project_id": PROJECT_ID}, Q(project_id=uuid.UUID(PROJECT_ID))),
    ({"type_id": TYPE_ID}, Q(type_id=uuid.UUID(TYPE_ID))),
    (
        {"labels__id": LABEL_ID},
        Q(labels__id=uuid.UUID(LABEL_ID)) & Q(label_issue__deleted_at__isnull=True),
    ),
    (
        {"assignees__id": ASSIGNEE_ID},
        Q(assignees__id=uuid.UUID(ASSIGNEE_ID)) & Q(issue_assignee__deleted_at__isnull=True),
    ),
    (
        {"issue_module__module_id": MODULE_ID},
        Q(issue_module__module_id=uuid.UUID(MODULE_ID)) & Q(issue_module__deleted_at__isnull=True),
    ),
    (
        {"cycle_id": CYCLE_ID},
        Q(issue_cycle__cycle_id=uuid.UUID(CYCLE_ID)) & Q(issue_cycle__deleted_at__isnull=True),
    ),
    ({"created_by": USER_ID}, Q(created_by_id=uuid.UUID(USER_ID))),
    ({"parent_id": PARENT_ID}, Q(parent_id=uuid.UUID(PARENT_ID))),
    ({"target_date": "2024-05-01"}, Q(target_date=date(2024, 5, 1))),
    ({"start_date": "2024-05-01"}, Q(start_date=date(2024, 5, 1))),
]

LOOKUP_CASES = [
    ({"priority": "urgent"}, Q(priority="urgent")),
    ({"priority__in": ["urgent", "high"]}, Q(priority__in=["urgent", "high"])),
    ({"priority__isnull": True}, Q(priority__isnull=True)),
    ({"priority__icontains": "urg"}, Q(priority__icontains="urg")),
    ({"target_date__gt": "2024-05-01"}, Q(target_date__gt=date(2024, 5, 1))),
    ({"target_date__gte": "2024-05-01"}, Q(target_date__gte=date(2024, 5, 1))),
    ({"target_date__lt": "2024-05-01"}, Q(target_date__lt=date(2024, 5, 1))),
    ({"target_date__lte": "2024-05-01"}, Q(target_date__lte=date(2024, 5, 1))),
    (
        {"start_date__range": ["2024-05-01", "2024-05-31"]},
        Q(start_date__range=[date(2024, 5, 1), date(2024, 5, 31)]),
    ),
    ({"start_date__isnull": False}, Q(start_date__isnull=False)),
    ({"state_id__in": [STATE_ID]}, Q(state_id__in=[uuid.UUID(STATE_ID)])),
]

# Field names that must never reach the ORM. The relational ones are the same
# class of payload as the order_by injection fixed by GHSA-p885-6jpg-cr2p.
REJECTED_FIELDS = [
    "assignees__email",
    "assignees__id__exact__email",
    "project__workspace__owner",
    "created_by__password",
    "created_by__token",
    "state__name",
    "name",
    "description_stripped",
    "workspace_id",
    "id",
    "",
    "state",
    "labels",
    "state_id__password",
    "milestone_id",
    "release_work_items__release_id",
]

REJECTED_LOOKUPS = [
    "state_id__gt",
    "state_id__icontains",
    "state_id__range",
    "priority__gte",
    "priority__range",
    "labels__id__contains",
    "labels__id__regex",
    "target_date__year",
    "target_date__iexact",
]


@pytest.mark.unit
class TestAllowedFieldsAndLookups:
    @pytest.mark.parametrize("expression, expected", FIELD_CASES)
    def test_every_allowed_field_compiles(self, expression, expected):
        assert compile_filters(expression).q == expected

    def test_field_cases_cover_the_allowlist(self):
        covered = {next(iter(expression)) for expression, _ in FIELD_CASES}
        assert covered == set(FILTER_FIELDS)

    @pytest.mark.parametrize("expression, expected", LOOKUP_CASES)
    def test_every_allowed_lookup_compiles(self, expression, expected):
        assert compile_filters(expression).q == expected

    def test_uuid_values_are_coerced(self):
        compiled = compile_filters({"state_id": STATE_ID})
        assert compiled.q.children == [("state_id", uuid.UUID(STATE_ID))]

    def test_multiple_keys_in_one_object_are_anded(self):
        expression = {"priority": "urgent", "state__group": "started"}
        assert compile_filters(expression).q == Q(priority="urgent") & Q(state__group="started")


@pytest.mark.unit
class TestRejection:
    @pytest.mark.parametrize("field", REJECTED_FIELDS)
    def test_rejected_field_raises(self, field):
        with pytest.raises(FilterCompileError) as excinfo:
            compile_filters({field: "value"})
        assert excinfo.value.field == field

    @pytest.mark.parametrize("key", REJECTED_LOOKUPS)
    def test_rejected_lookup_raises(self, key):
        with pytest.raises(FilterCompileError):
            compile_filters({key: "value"})

    def test_rejected_field_inside_a_nested_group_raises(self):
        expression = {"and": [{"priority": "urgent"}, {"or": [{"created_by__password": "x"}]}]}
        with pytest.raises(FilterCompileError):
            compile_filters(expression)

    def test_unsupported_field_says_why(self):
        with pytest.raises(FilterCompileError) as excinfo:
            compile_filters({"milestone_id": STATE_ID})
        assert "not supported" in excinfo.value.message

    def test_error_carries_field_and_lookup(self):
        with pytest.raises(FilterCompileError) as excinfo:
            compile_filters({"priority__range": ["a", "b"]})
        assert excinfo.value.field == "priority"
        assert excinfo.value.lookup == "range"


@pytest.mark.unit
class TestGroups:
    def test_sdk_documented_example_compiles(self):
        expression = {"and": [{"priority": "urgent"}, {"state_group__in": ["unstarted", "started"]}]}
        assert compile_filters(expression).q == Q(priority="urgent") & Q(state__group__in=["unstarted", "started"])

    def test_or_group(self):
        expression = {"or": [{"priority": "urgent"}, {"priority": "high"}]}
        assert compile_filters(expression).q == Q(priority="urgent") | Q(priority="high")

    def test_not_group_with_object(self):
        assert compile_filters({"not": {"priority": "urgent"}}).q == ~Q(priority="urgent")

    def test_not_group_with_list_is_negated_conjunction(self):
        expression = {"not": [{"priority": "urgent"}, {"state__group": "started"}]}
        assert compile_filters(expression).q == ~(Q(priority="urgent") & Q(state__group="started"))

    def test_mixed_nesting(self):
        expression = {
            "and": [
                {"project_id": PROJECT_ID},
                {"or": [{"priority": "urgent"}, {"not": {"state__group": "completed"}}]},
            ]
        }
        expected = Q(project_id=uuid.UUID(PROJECT_ID)) & (Q(priority="urgent") | ~Q(state__group="completed"))
        assert compile_filters(expression).q == expected

    def test_single_member_group_unwraps(self):
        assert compile_filters({"and": [{"priority": "low"}]}).q == Q(priority="low")

    @pytest.mark.parametrize("operator", ["and", "or"])
    def test_group_operand_must_be_a_non_empty_list(self, operator):
        with pytest.raises(FilterCompileError):
            compile_filters({operator: []})
        with pytest.raises(FilterCompileError):
            compile_filters({operator: {"priority": "urgent"}})

    def test_operator_must_be_the_only_key(self):
        with pytest.raises(FilterCompileError):
            compile_filters({"and": [{"priority": "urgent"}], "priority": "high"})


def nest(levels):
    """Build a filter expression nested `levels` objects deep."""
    node = {"priority": "urgent"}
    for _ in range(levels - 1):
        node = {"and": [node]}
    return node


@pytest.mark.unit
class TestDepthLimit:
    def test_maximum_depth_is_accepted(self):
        assert compile_filters(nest(MAX_FILTER_DEPTH)).q == Q(priority="urgent")

    def test_one_level_too_deep_is_rejected(self):
        with pytest.raises(FilterCompileError) as excinfo:
            compile_filters(nest(MAX_FILTER_DEPTH + 1))
        assert "nested deeper" in excinfo.value.message

    def test_deeply_nested_payload_does_not_recurse_without_bound(self):
        with pytest.raises(FilterCompileError):
            compile_filters(nest(500))


@pytest.mark.unit
class TestMalformedInput:
    @pytest.mark.parametrize("expression", [None, [], ["priority"], "priority=urgent", 7, True])
    def test_top_level_must_be_an_object(self, expression):
        with pytest.raises(FilterCompileError):
            compile_filters(expression)

    def test_empty_object_is_rejected(self):
        with pytest.raises(FilterCompileError):
            compile_filters({})

    @pytest.mark.parametrize("operator", ["xor", "nand", "AND", "$or", "filter"])
    def test_unknown_top_level_operator_is_rejected(self, operator):
        with pytest.raises(FilterCompileError):
            compile_filters({operator: [{"priority": "urgent"}]})

    def test_nested_member_must_be_an_object(self):
        with pytest.raises(FilterCompileError):
            compile_filters({"and": ["priority"]})

    @pytest.mark.parametrize(
        "expression",
        [
            {"priority": 5},
            {"priority": True},
            {"priority": ["urgent"]},
            {"priority": "critical"},
            {"state__group": "in_progress"},
            {"state_id": "not-a-uuid"},
            {"state_id": 12},
            {"state_id__in": STATE_ID},
            {"state_id__in": []},
            {"target_date": "01/05/2024"},
            {"target_date": 20240501},
            {"start_date__range": ["2024-05-01"]},
            {"start_date__range": ["2024-05-01", "2024-05-02", "2024-05-03"]},
            {"priority__isnull": "true"},
            {"priority__icontains": 5},
            {"state_id__isnull": 1},
        ],
    )
    def test_wrong_value_type_is_rejected(self, expression):
        with pytest.raises(FilterCompileError):
            compile_filters(expression)


@pytest.mark.unit
class TestCustomPropertyLeaves:
    def test_leaf_is_collected_not_compiled_into_q(self):
        compiled = compile_filters({f"property__{PROPERTY_ID}": "yes"})
        assert compiled.q == Q()
        assert compiled.custom_properties == [
            CustomPropertyFilter(property_id=PROPERTY_ID, lookup="exact", value="yes")
        ]

    @pytest.mark.parametrize("lookup", ["gt", "lt"])
    def test_number_comparison_lookups(self, lookup):
        compiled = compile_filters({f"property__{PROPERTY_ID}__{lookup}": 3})
        assert compiled.custom_properties == [CustomPropertyFilter(property_id=PROPERTY_ID, lookup=lookup, value=3)]

    def test_collected_alongside_allowlisted_fields(self):
        expression = {"and": [{"priority": "urgent"}, {f"property__{PROPERTY_ID}": "yes"}]}
        compiled = compile_filters(expression)
        assert compiled.q == Q(priority="urgent")
        assert len(compiled.custom_properties) == 1

    @pytest.mark.parametrize("operator", ["or", "not"])
    def test_rejected_outside_conjunctive_position(self, operator):
        with pytest.raises(FilterCompileError):
            compile_filters({operator: [{f"property__{PROPERTY_ID}": "yes"}]})

    @pytest.mark.parametrize("key", ["property__not-a-uuid", "property__", "property__1__gt"])
    def test_invalid_property_id_is_rejected(self, key):
        with pytest.raises(FilterCompileError):
            compile_filters({key: "yes"})
