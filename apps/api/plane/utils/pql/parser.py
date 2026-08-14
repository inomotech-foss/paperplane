# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Parse Plane Query Language into the `filters` JSON AST.

PQL is the human-readable surface of the same AST `plane.utils.pql.filters`
compiles, so `parse_pql` output is a valid `compile_filters` input:

    priority = "urgent" AND assignee = currentUser()
    {"and": [{"priority": "urgent"}, {"assignees__id": {"$currentUser": True}}]}

Grammar:

    expression  := or_expr
    or_expr     := and_expr (OR and_expr)*
    and_expr    := not_expr (AND not_expr)*
    not_expr    := NOT not_expr | primary
    primary     := '(' expression ')' | predicate
    predicate   := field comparison | 'cf' '[' string ']' comparison | childOf '(' string ')'
    comparison  := ('=' | '!=' | '>' | '>=' | '<' | '<=' | '~') value
                 | 'in' list | 'not' 'in' list
                 | 'is' 'null' | 'is' 'not' 'null'
    list        := '(' value (',' value)* ')'
    value       := string | number | identifier | 'currentUser' '(' ')' | now_expr
    now_expr    := 'now' '(' ')' (('+' | '-') duration)*

Field names are the allowlist in `plane.utils.pql.fields`, matched
case-insensitively, plus the short aliases in `FIELD_ALIASES` below that the
SDK and the MCP server already advertise (`assignee`, `type`). No name outside
the allowlist parses.

Placeholders. Three constructs cannot be resolved without a request user, a
clock or a database query, and this module stays pure, so it emits placeholder
objects for the endpoint wiring to substitute before calling `compile_filters`:

    currentUser()      {"$currentUser": True}       -> the request user's id
    now() - 7d         {"$now": {"seconds": -604800}} -> that offset from now
    childOf("PROJ-12") {"$childOf": "PROJ-12"}      -> the parent work item id

The first two sit in value position inside an otherwise complete leaf; the
third is a whole node, because the field it resolves to needs the identifier
looked up first. `compile_filters` rejects all three unsubstituted, which is
the intended failure mode: substitution is not optional.
"""

from plane.utils.pql.fields import (
    CUSTOM_PROPERTY_PREFIX,
    EXACT,
    FIELD_ALIASES as SDK_FIELD_ALIASES,
    FILTER_FIELDS,
    GT,
    GTE,
    ICONTAINS,
    IN,
    ISNULL,
    LT,
    LTE,
    UNSUPPORTED_FIELDS,
)
from plane.utils.pql.lexer import (
    COMMA,
    DURATION,
    EOF,
    IDENT,
    LBRACKET,
    LPAREN,
    MINUS,
    NUMBER,
    OPERATOR,
    PLUS,
    RBRACKET,
    RPAREN,
    STRING,
    PQLSyntaxError,
    tokenize,
)

CURRENT_USER_PLACEHOLDER = "$currentUser"
NOW_PLACEHOLDER = "$now"
CHILD_OF_PLACEHOLDER = "$childOf"

MAX_PQL_DEPTH = 25

# Short names the SDK and the MCP server advertise, resolved onto the allowlist.
FIELD_ALIASES = {
    **SDK_FIELD_ALIASES,
    "assignee": "assignees__id",
    "assignees": "assignees__id",
    "created_by_id": "created_by",
    "cycle": "cycle_id",
    "label": "labels__id",
    "labels": "labels__id",
    "module": "issue_module__module_id",
    "module_id": "issue_module__module_id",
    "project": "project_id",
    "state": "state_id",
    "type": "type_id",
}

KNOWN_FIELD_NAMES = sorted(set(FILTER_FIELDS) | set(FIELD_ALIASES))

OPERATOR_LOOKUPS = {
    "=": (EXACT, False),
    "!=": (EXACT, True),
    ">": (GT, False),
    ">=": (GTE, False),
    "<": (LT, False),
    "<=": (LTE, False),
    "~": (ICONTAINS, False),
}

# `split_custom_property_lookup` understands these three and nothing else.
CUSTOM_PROPERTY_OPERATORS = {"=": EXACT, ">": GT, "<": LT}

FUNCTIONS = {"currentuser": "currentUser", "now": "now", "childof": "childOf"}
VALUE_FUNCTIONS = ("currentUser", "now")

KEYWORDS = frozenset({"and", "or", "not", "in", "is", "null"})


def parse_pql(source):
    """Parse a PQL string into a `filters` AST.

    Raises `PQLSyntaxError`, which carries the offset, line, column, offending
    token and what was expected there.
    """
    if not isinstance(source, str):
        raise PQLSyntaxError("query must be a string", "", 0, expected="a PQL expression")
    return _Parser(source, tokenize(source)).parse()


class _Parser:
    def __init__(self, source, tokens):
        self.source = source
        self.tokens = tokens
        self.index = 0

    def parse(self):
        if self._peek().kind == EOF:
            raise self._error(self._peek(), "empty query", "a filter expression")
        node = self._parse_or(0)
        token = self._peek()
        if token.kind != EOF:
            raise self._error(token, f"unexpected {token.describe()}", "'AND', 'OR' or end of input")
        return node

    def _parse_or(self, depth):
        members = [self._parse_and(depth)]
        while self._match_keyword("or"):
            members.append(self._parse_and(depth))
        return members[0] if len(members) == 1 else {"or": members}

    def _parse_and(self, depth):
        members = [self._parse_not(depth)]
        while self._match_keyword("and"):
            members.append(self._parse_not(depth))
        return members[0] if len(members) == 1 else {"and": members}

    def _parse_not(self, depth):
        if self._match_keyword("not"):
            return {"not": [self._parse_not(depth)]}
        return self._parse_primary(depth)

    def _parse_primary(self, depth):
        if depth >= MAX_PQL_DEPTH:
            raise self._error(
                self._peek(),
                f"expression is nested deeper than {MAX_PQL_DEPTH} levels",
                "a shallower expression",
            )
        if self._peek().kind == LPAREN:
            self._advance()
            node = self._parse_or(depth + 1)
            self._expect(RPAREN, "')'")
            return node
        return self._parse_predicate()

    def _parse_predicate(self):
        token = self._peek()
        if token.kind != IDENT:
            raise self._error(token, f"unexpected {token.describe()}", "a field name, 'NOT' or '('")
        lowered = token.value.lower()
        if lowered in KEYWORDS:
            raise self._error(token, f"'{token.value}' is a keyword, not a field name", "a field name, 'NOT' or '('")
        if lowered == "cf":
            return self._parse_custom_property()
        if self._peek(1).kind == LPAREN:
            return self._parse_predicate_function()
        return self._parse_field_predicate()

    def _parse_predicate_function(self):
        token = self._peek()
        name = FUNCTIONS.get(token.value.lower())
        if name is None:
            raise self._error(
                token, f"unknown function '{token.value}'", "one of " + ", ".join(sorted(FUNCTIONS.values()))
            )
        if name != "childOf":
            raise self._error(token, f"{name}() is a value, not a condition", "a field name before it")
        arguments = self._parse_call_arguments()
        if len(arguments) != 1:
            raise self._error(
                token,
                f"childOf() takes exactly one argument, got {len(arguments)}",
                'a quoted work item identifier such as childOf("PROJ-12")',
            )
        identifier, argument_token = arguments[0]
        if not isinstance(identifier, str) or argument_token.kind != STRING:
            raise self._error(argument_token, "childOf() takes a quoted work item identifier", "a string literal")
        return {CHILD_OF_PLACEHOLDER: identifier}

    def _parse_field_predicate(self):
        token = self._advance()
        name = self._resolve_field(token)
        field = FILTER_FIELDS[name]
        operator = self._peek()

        if operator.kind == OPERATOR:
            self._advance()
            lookup, negated = OPERATOR_LOOKUPS[operator.value]
            self._check_lookup(field, name, lookup, operator)
            leaf = {_leaf_key(name, lookup): self._parse_value()}
            return {"not": [leaf]} if negated else leaf

        if operator.kind == IDENT:
            keyword = operator.value.lower()
            if keyword == "in":
                self._advance()
                self._check_lookup(field, name, IN, operator)
                return {_leaf_key(name, IN): self._parse_list()}
            if keyword == "not":
                self._advance()
                self._expect_keyword("in", "'in' after 'not'")
                self._check_lookup(field, name, IN, operator)
                return {"not": [{_leaf_key(name, IN): self._parse_list()}]}
            if keyword == "is":
                self._advance()
                negated = bool(self._match_keyword("not"))
                self._expect_keyword("null", "'null'")
                self._check_lookup(field, name, ISNULL, operator)
                return {_leaf_key(name, ISNULL): not negated}

        raise self._error(
            operator,
            f"unexpected {operator.describe()} after field '{name}'",
            "a comparison operator such as '=', 'in', '~' or 'is null'",
        )

    def _parse_custom_property(self):
        self._advance()
        self._expect(LBRACKET, "'[' after 'cf'")
        key = self._expect(STRING, 'a quoted property id such as cf["<property uuid>"]')
        self._expect(RBRACKET, "']'")
        operator = self._peek()
        if operator.kind != OPERATOR or operator.value not in CUSTOM_PROPERTY_OPERATORS:
            raise self._error(
                operator,
                f"unexpected {operator.describe()} after a custom property",
                "one of '=', '>', '<'",
            )
        self._advance()
        lookup = CUSTOM_PROPERTY_OPERATORS[operator.value]
        suffix = "" if lookup == EXACT else f"__{lookup}"
        return {f"{CUSTOM_PROPERTY_PREFIX}{key.value}{suffix}": self._parse_value()}

    def _parse_list(self):
        self._expect(LPAREN, "'(' to open a value list")
        if self._peek().kind == RPAREN:
            raise self._error(self._peek(), "empty value list", "at least one value")
        values = [self._parse_value()]
        while self._peek().kind == COMMA:
            self._advance()
            values.append(self._parse_value())
        self._expect(RPAREN, "',' or ')'")
        return values

    def _parse_value(self):
        token = self._peek()
        if token.kind in (STRING, NUMBER):
            self._advance()
            return token.value
        if token.kind == MINUS and self._peek(1).kind == NUMBER:
            self._advance()
            return -self._advance().value
        if token.kind == IDENT:
            if self._peek(1).kind == LPAREN:
                return self._parse_value_function()
            if token.value.lower() in KEYWORDS:
                hint = "'is null' to test for an unset field" if token.value.lower() == "null" else "a value"
                raise self._error(token, f"'{token.value}' is a keyword, not a value", hint)
            self._advance()
            return token.value
        if token.kind == DURATION:
            raise self._error(token, "a duration is only allowed after now()", "a value such as now() - 7d")
        raise self._error(token, f"unexpected {token.describe()}", "a value")

    def _parse_value_function(self):
        token = self._peek()
        name = FUNCTIONS.get(token.value.lower())
        if name is None:
            raise self._error(
                token, f"unknown function '{token.value}'", "one of " + ", ".join(sorted(FUNCTIONS.values()))
            )
        if name not in VALUE_FUNCTIONS:
            raise self._error(token, f"{name}() is a condition, not a value", "one of " + ", ".join(VALUE_FUNCTIONS))
        arguments = self._parse_call_arguments()
        if arguments:
            raise self._error(token, f"{name}() takes no arguments, got {len(arguments)}", f"{name}()")
        if name == "currentUser":
            return {CURRENT_USER_PLACEHOLDER: True}
        return {NOW_PLACEHOLDER: {"seconds": self._parse_now_offset()}}

    def _parse_now_offset(self):
        seconds = 0
        while self._peek().kind in (PLUS, MINUS):
            sign = 1 if self._advance().kind == PLUS else -1
            duration = self._peek()
            if duration.kind != DURATION:
                raise self._error(duration, f"unexpected {duration.describe()}", "a duration such as 7d, 2w or 12h")
            self._advance()
            seconds += sign * duration.value
        return seconds

    def _parse_call_arguments(self):
        self._advance()
        self._expect(LPAREN, "'(' after a function name")
        arguments = []
        if self._peek().kind != RPAREN:
            token = self._peek()
            arguments.append((self._parse_value(), token))
            while self._peek().kind == COMMA:
                self._advance()
                token = self._peek()
                arguments.append((self._parse_value(), token))
        self._expect(RPAREN, "')' to close the argument list")
        return arguments

    def _resolve_field(self, token):
        name = token.value.lower()
        name = FIELD_ALIASES.get(name, name)
        if name in FILTER_FIELDS:
            return name
        if name in UNSUPPORTED_FIELDS:
            raise self._error(
                token,
                f"field '{token.value}' is not supported: {UNSUPPORTED_FIELDS[name]}",
                "another field",
            )
        raise self._error(token, f"unknown field '{token.value}'", "one of " + ", ".join(KNOWN_FIELD_NAMES))

    def _check_lookup(self, field, name, lookup, token):
        if lookup not in field.lookups:
            raise self._error(
                token,
                f"operator '{token.text}' is not supported on field '{name}'",
                "one of " + ", ".join(sorted(_operators_for(field))),
            )

    def _peek(self, offset=0):
        index = min(self.index + offset, len(self.tokens) - 1)
        return self.tokens[index]

    def _advance(self):
        token = self._peek()
        if token.kind != EOF:
            self.index += 1
        return token

    def _expect(self, kind, expected):
        token = self._peek()
        if token.kind != kind:
            raise self._error(token, f"unexpected {token.describe()}", expected)
        return self._advance()

    def _match_keyword(self, keyword):
        token = self._peek()
        if token.kind == IDENT and token.value.lower() == keyword:
            self._advance()
            return token
        return None

    def _expect_keyword(self, keyword, expected):
        token = self._match_keyword(keyword)
        if token is None:
            found = self._peek()
            raise self._error(found, f"unexpected {found.describe()}", expected)
        return token

    def _error(self, token, detail, expected=None):
        text = None if token.kind == EOF else token.text
        return PQLSyntaxError(detail, self.source, token.start, token=text, expected=expected)


def _leaf_key(name, lookup):
    return name if lookup == EXACT else f"{name}__{lookup}"


def _operators_for(field):
    symbols = {lookup: symbol for symbol, (lookup, negated) in OPERATOR_LOOKUPS.items() if not negated}
    available = {symbols[lookup] for lookup in field.lookups if lookup in symbols}
    if IN in field.lookups:
        available.add("in")
    if ISNULL in field.lookups:
        available.add("is null")
    return available
