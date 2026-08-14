# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Unit tests for the PQL lexer and parser.

The parser is pure: text in, `filters` AST out, no clock, no request and no
database. The end-to-end table at the bottom is the load-bearing one, because
it feeds parser output straight into `compile_filters` and proves the two
halves of the query pipeline still fit together.
"""

import uuid
from datetime import date

import pytest
from django.db.models import Q

from plane.utils.pql import (
    CHILD_OF_PLACEHOLDER,
    CURRENT_USER_PLACEHOLDER,
    NOW_PLACEHOLDER,
    FilterCompileError,
    PQLSyntaxError,
    compile_filters,
    parse_pql,
)
from plane.utils.pql.filters import CustomPropertyFilter
from plane.utils.pql.lexer import DURATION, EOF, IDENT, NUMBER, OPERATOR, STRING, tokenize
from plane.utils.pql.parser import MAX_PQL_DEPTH

STATE_ID = "11111111-1111-4111-8111-111111111111"
LABEL_ID = "44444444-4444-4444-8444-444444444444"
ASSIGNEE_ID = "55555555-5555-4555-8555-555555555555"
TYPE_ID = "33333333-3333-4333-8333-333333333333"
PROPERTY_ID = "99999999-9999-4999-8999-999999999999"
OPTION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

CURRENT_USER = {CURRENT_USER_PLACEHOLDER: True}

WEEK = 604800

OPERATOR_CASES = [
    ("priority = urgent", {"priority": "urgent"}),
    ('priority = "urgent"', {"priority": "urgent"}),
    ("priority != urgent", {"not": [{"priority": "urgent"}]}),
    ('target_date > "2024-05-01"', {"target_date__gt": "2024-05-01"}),
    ('target_date >= "2024-05-01"', {"target_date__gte": "2024-05-01"}),
    ('start_date < "2024-05-01"', {"start_date__lt": "2024-05-01"}),
    ('start_date <= "2024-05-01"', {"start_date__lte": "2024-05-01"}),
    ('priority ~ "urg"', {"priority__icontains": "urg"}),
    ("priority in (urgent, high)", {"priority__in": ["urgent", "high"]}),
    ("priority not in (low)", {"not": [{"priority__in": ["low"]}]}),
    ("target_date is null", {"target_date__isnull": True}),
    ("target_date is not null", {"target_date__isnull": False}),
    ("TARGET_DATE IS NULL", {"target_date__isnull": True}),
]

FIELD_NAME_CASES = [
    ("assignee = " + f'"{ASSIGNEE_ID}"', {"assignees__id": ASSIGNEE_ID}),
    ('assignees__id = "' + ASSIGNEE_ID + '"', {"assignees__id": ASSIGNEE_ID}),
    ('label = "' + LABEL_ID + '"', {"labels__id": LABEL_ID}),
    ('state = "' + STATE_ID + '"', {"state_id": STATE_ID}),
    ("state_group = started", {"state__group": "started"}),
    ("state__group = started", {"state__group": "started"}),
    ('type = "' + TYPE_ID + '"', {"type_id": TYPE_ID}),
    ('cycle = "' + STATE_ID + '"', {"cycle_id": STATE_ID}),
    ('module = "' + STATE_ID + '"', {"issue_module__module_id": STATE_ID}),
]

FUNCTION_CASES = [
    ("assignee = currentUser()", {"assignees__id": CURRENT_USER}),
    ("assignee = currentuser()", {"assignees__id": CURRENT_USER}),
    ("created_by != currentUser()", {"not": [{"created_by": CURRENT_USER}]}),
    ("assignee in (currentUser())", {"assignees__id__in": [CURRENT_USER]}),
    ("target_date = now()", {"target_date": {NOW_PLACEHOLDER: {"seconds": 0}}}),
    ("target_date > now() - 7d", {"target_date__gt": {NOW_PLACEHOLDER: {"seconds": -WEEK}}}),
    ("target_date < now() + 1w", {"target_date__lt": {NOW_PLACEHOLDER: {"seconds": WEEK}}}),
    ("target_date < now() + 1w - 12h", {"target_date__lt": {NOW_PLACEHOLDER: {"seconds": WEEK - 43200}}}),
    ('childOf("PROJ-12")', {CHILD_OF_PLACEHOLDER: "PROJ-12"}),
    ('CHILDOF("PROJ-12")', {CHILD_OF_PLACEHOLDER: "PROJ-12"}),
]

PRECEDENCE_CASES = [
    # NOT binds tighter than AND.
    (
        "NOT priority = urgent AND state__group = started",
        {"and": [{"not": [{"priority": "urgent"}]}, {"state__group": "started"}]},
    ),
    # AND binds tighter than OR.
    (
        "priority = low OR priority = high AND state__group = started",
        {"or": [{"priority": "low"}, {"and": [{"priority": "high"}, {"state__group": "started"}]}]},
    ),
    # NOT binds tighter than OR.
    (
        "NOT priority = urgent OR state__group = started",
        {"or": [{"not": [{"priority": "urgent"}]}, {"state__group": "started"}]},
    ),
    # Parentheses override each of them.
    (
        "(priority = low OR priority = high) AND state__group = started",
        {"and": [{"or": [{"priority": "low"}, {"priority": "high"}]}, {"state__group": "started"}]},
    ),
    (
        "NOT (priority = urgent AND state__group = started)",
        {"not": [{"and": [{"priority": "urgent"}, {"state__group": "started"}]}]},
    ),
    ("(((priority = urgent)))", {"priority": "urgent"}),
    # Same-level chains flatten into one group.
    (
        "priority = low AND priority = high AND priority = medium",
        {"and": [{"priority": "low"}, {"priority": "high"}, {"priority": "medium"}]},
    ),
    ("priority = low and priority = high", {"and": [{"priority": "low"}, {"priority": "high"}]}),
    ("priority = low Or priority = high", {"or": [{"priority": "low"}, {"priority": "high"}]}),
]

QUOTING_CASES = [
    ('priority = "urgent"', "urgent"),
    ("priority = 'urgent'", "urgent"),
    ('priority = "it\'s urgent"', "it's urgent"),
    ("priority = 'say \"urgent\"'", 'say "urgent"'),
    ('priority = "say \\"urgent\\""', 'say "urgent"'),
    ("priority = 'it\\'s urgent'", "it's urgent"),
    ('priority = "back\\\\slash"', "back\\slash"),
    ('priority = "line\\nbreak"', "line\nbreak"),
    ('priority = "tab\\there"', "tab\there"),
    ('priority = ""', ""),
]

IN_CASES = [
    ("state__group in (started)", {"state__group__in": ["started"]}),
    (
        "state__group in (unstarted, started)",
        {"state__group__in": ["unstarted", "started"]},
    ),
    (
        'state__group in (backlog, "unstarted", started, completed)',
        {"state__group__in": ["backlog", "unstarted", "started", "completed"]},
    ),
    ("state__group not in (backlog)", {"not": [{"state__group__in": ["backlog"]}]}),
]

CUSTOM_PROPERTY_CASES = [
    (f'cf["{PROPERTY_ID}"] = "{OPTION_ID}"', {f"property__{PROPERTY_ID}": OPTION_ID}),
    (f'cf["{PROPERTY_ID}"] > 5', {f"property__{PROPERTY_ID}__gt": 5}),
    (f'cf["{PROPERTY_ID}"] < 5.5', {f"property__{PROPERTY_ID}__lt": 5.5}),
    (f'cf["{PROPERTY_ID}"] > -2', {f"property__{PROPERTY_ID}__gt": -2}),
    (f'cf["{PROPERTY_ID}"] = true', {f"property__{PROPERTY_ID}": "true"}),
]

# The syntax the SDK and the MCP server already advertise to clients, verbatim.
DOCUMENTED_CASES = [
    (
        'priority = "urgent" AND assignee = currentUser()',
        {"and": [{"priority": "urgent"}, {"assignees__id": CURRENT_USER}]},
    ),
    ('type = "<type id>"', {"type_id": "<type id>"}),
    ('childOf("<EPIC-IDENTIFIER>")', {CHILD_OF_PLACEHOLDER: "<EPIC-IDENTIFIER>"}),
    ('cf["<property.id>"] = "<option.id>"', {"property__<property.id>": "<option.id>"}),
]

ERROR_CASES = [
    ("", 0, "empty query"),
    ("   ", 3, "empty query"),
    ('priority = "urgent', 11, "unterminated string literal"),
    ("priority = 'urgent", 11, "unterminated string literal"),
    ('priority = "bad \\q escape"', 16, "unknown escape sequence"),
    ("(priority = urgent", 18, "expected ')'"),
    ("priority = urgent)", 17, "unexpected ')'"),
    ("priority = urgent AND", 21, "unexpected end of input"),
    ("priority = urgent OR", 20, "unexpected end of input"),
    ("priority =", 10, "unexpected end of input"),
    ("NOT", 3, "unexpected end of input"),
    ("= urgent", 0, "unexpected '='"),
    ("AND priority = urgent", 0, "'AND' is a keyword, not a field name"),
    ("foo = urgent", 0, "unknown field 'foo'"),
    ("assignees__email = x", 0, "unknown field 'assignees__email'"),
    ("milestone_id = x", 0, "milestones are not available"),
    ("priority", 8, "unexpected end of input"),
    ("priority urgent", 9, "unexpected 'urgent'"),
    ("priority > urgent", 9, "operator '>' is not supported on field 'priority'"),
    ("target_date ~ x", 12, "operator '~' is not supported on field 'target_date'"),
    ("childOf()", 0, "childOf() takes exactly one argument, got 0"),
    ('childOf("A", "B")', 0, "childOf() takes exactly one argument, got 2"),
    ("childOf(PROJ)", 8, "childOf() takes a quoted work item identifier"),
    ("assignee = currentUser(1)", 11, "currentUser() takes no arguments, got 1"),
    ("target_date = now(1)", 14, "now() takes no arguments, got 1"),
    ("currentUser()", 0, "currentUser() is a value, not a condition"),
    ('assignee = childOf("PROJ-12")', 11, "childOf() is a condition, not a value"),
    ("assignee = whoAmI()", 11, "unknown function 'whoAmI'"),
    ("whoAmI()", 0, "unknown function 'whoAmI'"),
    ("priority in ()", 13, "empty value list"),
    ("priority in (urgent,)", 20, "unexpected ')'"),
    ("priority in urgent", 12, "expected '(' to open a value list"),
    ("priority not urgent", 13, "expected 'in' after 'not'"),
    ("target_date is nul", 15, "expected 'null'"),
    ("priority = null", 11, "'null' is a keyword, not a value"),
    ("priority = and", 11, "'and' is a keyword, not a value"),
    ("target_date = 7d", 14, "a duration is only allowed after now()"),
    ("target_date > now() - 7", 22, "expected a duration"),
    ("target_date > now() - 7y", 23, "unknown duration unit 'y'"),
    ("priority & urgent", 9, "unexpected character '&'"),
    ("cf = 1", 3, "expected '[' after 'cf'"),
    ("cf[1] = 2", 3, "quoted property id"),
    ('cf["p" = 2', 7, "expected ']'"),
    ('cf["p"] != 2', 8, "expected one of '=', '>', '<'"),
    ('cf["p"] in (2)', 8, "expected one of '=', '>', '<'"),
]

COMPILE_CASES = [
    ("priority = urgent", Q(priority="urgent")),
    (
        "priority = urgent AND state__group in (unstarted, started)",
        Q(priority="urgent") & Q(state__group__in=["unstarted", "started"]),
    ),
    (
        "priority = urgent AND (state__group = started OR " + f'assignee = "{ASSIGNEE_ID}")',
        Q(priority="urgent")
        & (
            Q(state__group="started")
            | (Q(assignees__id=uuid.UUID(ASSIGNEE_ID)) & Q(issue_assignee__deleted_at__isnull=True))
        ),
    ),
    (
        'NOT priority = urgent AND target_date >= "2024-05-01"',
        ~Q(priority="urgent") & Q(target_date__gte=date(2024, 5, 1)),
    ),
    (
        "priority not in (low, none) OR target_date is null",
        ~Q(priority__in=["low", "none"]) | Q(target_date__isnull=True),
    ),
    (
        f'type = "{TYPE_ID}" AND priority ~ "urg"',
        Q(type_id=uuid.UUID(TYPE_ID)) & Q(priority__icontains="urg"),
    ),
]


@pytest.mark.parametrize(
    "query,expected",
    OPERATOR_CASES
    + FIELD_NAME_CASES
    + FUNCTION_CASES
    + PRECEDENCE_CASES
    + IN_CASES
    + CUSTOM_PROPERTY_CASES
    + DOCUMENTED_CASES,
)
def test_parse_produces_expected_ast(query, expected):
    assert parse_pql(query) == expected


@pytest.mark.parametrize("query,expected", QUOTING_CASES)
def test_string_literals(query, expected):
    assert parse_pql(query) == {"priority": expected}


@pytest.mark.parametrize("query,position,detail", ERROR_CASES)
def test_parse_errors(query, position, detail):
    with pytest.raises(PQLSyntaxError) as excinfo:
        parse_pql(query)
    error = excinfo.value
    assert error.position == position
    assert detail in error.message
    assert f"offset {position}" in error.message
    assert error.line == 1
    assert error.column == position + 1


def test_error_reports_line_and_column_across_lines():
    with pytest.raises(PQLSyntaxError) as excinfo:
        parse_pql("priority = urgent\nAND foo = 1")
    error = excinfo.value
    assert (error.line, error.column) == (2, 5)
    assert error.token == "foo"
    assert error.expected.startswith("one of ")
    assert error.as_dict()["position"] == error.position


def test_error_carries_the_offending_token():
    with pytest.raises(PQLSyntaxError) as excinfo:
        parse_pql("priority = urgent)")
    assert excinfo.value.token == ")"


def test_non_string_input_is_rejected():
    with pytest.raises(PQLSyntaxError):
        parse_pql(None)


def test_nesting_is_bounded():
    with pytest.raises(PQLSyntaxError) as excinfo:
        parse_pql("(" * (MAX_PQL_DEPTH + 1) + "priority = urgent" + ")" * (MAX_PQL_DEPTH + 1))
    assert "nested deeper than" in excinfo.value.message


def test_tokenize_kinds():
    kinds = [token.kind for token in tokenize('priority = "x" AND target_date > now() - 7d')]
    assert kinds == [
        IDENT,
        OPERATOR,
        STRING,
        IDENT,
        IDENT,
        OPERATOR,
        IDENT,
        "(",
        ")",
        "-",
        DURATION,
        EOF,
    ]


def test_tokenize_records_offsets():
    tokens = tokenize("priority = urgent")
    assert (tokens[0].start, tokens[0].end) == (0, 8)
    assert (tokens[1].start, tokens[1].end) == (9, 10)
    assert (tokens[2].start, tokens[2].end) == (11, 17)
    assert tokens[-1].kind == EOF


def test_tokenize_numbers_and_durations():
    tokens = tokenize("1 2.5 3w")
    assert [(token.kind, token.value) for token in tokens[:3]] == [
        (NUMBER, 1),
        (NUMBER, 2.5),
        (DURATION, 3 * 604800),
    ]


@pytest.mark.parametrize("query,expected", COMPILE_CASES)
def test_parsed_ast_compiles(query, expected):
    assert compile_filters(parse_pql(query)).q == expected


def test_parsed_custom_property_compiles():
    compiled = compile_filters(parse_pql(f'priority = urgent AND cf["{PROPERTY_ID}"] = "{OPTION_ID}"'))
    assert compiled.q == Q(priority="urgent")
    assert compiled.custom_properties == [
        CustomPropertyFilter(property_id=PROPERTY_ID, lookup="exact", value=OPTION_ID)
    ]


def test_parsed_custom_property_range_compiles():
    compiled = compile_filters(parse_pql(f'cf["{PROPERTY_ID}"] > 5'))
    assert compiled.custom_properties == [CustomPropertyFilter(property_id=PROPERTY_ID, lookup="gt", value=5)]


@pytest.mark.parametrize(
    "query",
    [
        "assignee = currentUser()",
        "target_date > now() - 7d",
        'childOf("PROJ-12")',
    ],
)
def test_placeholders_do_not_compile_unsubstituted(query):
    """The endpoint substitutes placeholders first; compiling one is a bug, not a filter."""
    with pytest.raises(FilterCompileError):
        compile_filters(parse_pql(query))


def test_unknown_field_error_lists_the_allowlist():
    with pytest.raises(PQLSyntaxError) as excinfo:
        parse_pql("summary ~ x")
    assert "priority" in excinfo.value.expected
    assert "state__group" in excinfo.value.expected
