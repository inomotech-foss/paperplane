# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Parse Plane Query Language into the `filters` JSON AST.

PQL is the human-readable surface of the same AST `plane.utils.pql.filters`
compiles, so `parse_pql` output is a valid `compile_filters` input:

    priority = "urgent" AND assignee = currentUser()
    {"and": [{"priority": "urgent"}, {"assignees__id": {"$currentUser": True}}]}

The syntax lives in `PQL.g4`; the lexer, parser, listener and visitor under
`generated/` are produced from it by `pnpm --filter @plane/pql run generate`
and committed. This module adds what the grammar leaves open: the field
allowlist and aliases, which operators a field supports, function arity,
string escapes, duration units and the nesting limit. Checks that must point
at a token before the parser moves past it (unknown field, unknown function,
nesting depth) run in a parse listener; the rest run in the AST visitor.

Field names are the allowlist in `plane.utils.pql.fields`, matched
case-insensitively, plus the short aliases in `FIELD_ALIASES` below that the
SDK and the MCP server already advertise (`assignee`, `type`). No name outside
the allowlist parses.

Custom properties are addressed as `cf["<property id or name>"]` and accept
every comparison the field grammar has. The parser emits them as
`property__<reference>[__<lookup>]` leaves; what a reference and a lookup mean
for a given property type is decided by the resolver, not here.

Placeholders. Four constructs cannot be resolved without a request user, a
clock or a database query, and this module stays pure, so it emits placeholder
objects for the endpoint wiring to substitute before calling `compile_filters`:

    currentUser()            {"$currentUser": True}       -> the request user's id
    now() - 7d               {"$now": {"seconds": -604800}} -> that offset from now
    childOf("PROJ-12")       {"$childOf": "PROJ-12"}      -> the parent work item id
    descendantOf("PROJ-12")  {"$descendantOf": "PROJ-12"} -> that item's id, as an ancestor

The first two sit in value position inside an otherwise complete leaf; the
others are whole nodes, because the field they resolve to needs the identifier
looked up first. `compile_filters` rejects all of them unsubstituted, which is
the intended failure mode: substitution is not optional.

Keywords (`and`, `or`, `not`, `in`, `is`, `null`), `cf` and the function names
are reserved words: they cannot be used as a bare value or a field name. Quote
them to use them as a value.
"""

from dataclasses import dataclass
from typing import Any

from antlr4 import CommonTokenStream, InputStream, Token
from antlr4.error.ErrorListener import ErrorListener

from plane.utils.pql.errors import PQLSyntaxError
from plane.utils.pql.fields import (
    ANCESTOR_FIELD,
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
from plane.utils.pql.generated.PQLLexer import PQLLexer
from plane.utils.pql.generated.PQLListener import PQLListener
from plane.utils.pql.generated.PQLParser import PQLParser
from plane.utils.pql.generated.PQLVisitor import PQLVisitor

CURRENT_USER_PLACEHOLDER = "$currentUser"
NOW_PLACEHOLDER = "$now"
CHILD_OF_PLACEHOLDER = "$childOf"
DESCENDANT_OF_PLACEHOLDER = "$descendantOf"

MAX_PQL_DEPTH = 25

# Short names the SDK and the MCP server advertise, resolved onto the allowlist.
FIELD_ALIASES = {
    **SDK_FIELD_ALIASES,
    "ancestor": "ancestor_id",
    "assignee": "assignees__id",
    "assignees": "assignees__id",
    "completed": "completed_at",
    "created": "created_at",
    "created_by_id": "created_by",
    "cycle": "cycle_id",
    "due_date": "target_date",
    "label": "labels__id",
    "labels": "labels__id",
    "module": "issue_module__module_id",
    "module_id": "issue_module__module_id",
    "parent": "parent_id",
    "project": "project_id",
    "state": "state_id",
    "status": "state_id",
    "title": "name",
    "type": "type_id",
    "updated": "updated_at",
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

FUNCTIONS = {
    "currentuser": "currentUser",
    "now": "now",
    "childof": "childOf",
    "descendantof": "descendantOf",
}
VALUE_FUNCTIONS = ("currentUser", "now")
# Condition functions taking one quoted work item identifier, and the
# placeholder node each one emits.
IDENTIFIER_FUNCTIONS = {"childOf": CHILD_OF_PLACEHOLDER, "descendantOf": DESCENDANT_OF_PLACEHOLDER}
# The field each of those resolves onto, for error positions.
IDENTIFIER_FUNCTION_FIELDS = {"childOf": "parent_id", "descendantOf": ANCESTOR_FIELD}

ESCAPES = {"\\": "\\", '"': '"', "'": "'", "n": "\n", "r": "\r", "t": "\t"}

# Durations only need whole units; a work item query is never sub-hour precise.
DURATION_UNITS = {"h": 3600, "d": 86400, "w": 604800}

FUNCTION_TOKENS = frozenset({PQLParser.CURRENTUSER, PQLParser.NOW, PQLParser.CHILDOF, PQLParser.DESCENDANTOF})
KEYWORD_TOKENS = frozenset({PQLParser.AND, PQLParser.OR, PQLParser.NOT, PQLParser.IN, PQLParser.IS, PQLParser.NULL})
RESERVED_TOKENS = KEYWORD_TOKENS | {PQLParser.CF} | FUNCTION_TOKENS

# PQL operator strings in display order; the lookup each one needs and whether it negates.
PQL_OPERATORS = (
    ("=", EXACT, False),
    ("!=", EXACT, True),
    (">", GT, False),
    (">=", GTE, False),
    ("<", LT, False),
    ("<=", LTE, False),
    ("~", ICONTAINS, False),
    ("in", IN, False),
    ("not in", IN, True),
    ("is null", ISNULL, False),
    ("is not null", ISNULL, True),
)

TOKEN_DISPLAY = {
    Token.EOF: "end of input",
    PQLParser.IDENT: "an identifier",
    PQLParser.STRING: "a string",
    PQLParser.NUMBER: "a number",
    PQLParser.DURATION: "a duration",
}


@dataclass(frozen=True)
class Span:
    """Where a field name (`value` unset) or one of its values sits in the source."""

    field: str
    position: int
    token: str
    value: Any = None
    is_value: bool = False


def parse_pql(source):
    """Parse a PQL string into a `filters` AST.

    Raises `PQLSyntaxError`, which carries the offset, line, column, offending
    token and what was expected there.
    """
    return parse_pql_with_spans(source)[0]


def parse_pql_with_spans(source):
    """Parse like `parse_pql`, also returning the `Span` of every field and value."""
    if not isinstance(source, str):
        raise PQLSyntaxError("query must be a string", "", 0, expected="a PQL expression")
    lexer = PQLLexer(InputStream(source))
    lexer.removeErrorListeners()
    lexer.addErrorListener(_LexerErrors(source))
    parser = PQLParser(CommonTokenStream(lexer))
    parser.removeErrorListeners()
    parser.addErrorListener(_ParserErrors(source))
    parser.addParseListener(_SyntaxChecks(parser, source))
    builder = _AstBuilder(source)
    return builder.visit(parser.query()), builder.spans


def _error(source, token, detail, expected=None):
    text = None if token.type == Token.EOF else token.text
    return PQLSyntaxError(detail, source, token.start, token=text, expected=expected)


def _describe(token):
    if token.type == Token.EOF:
        return "end of input"
    if token.type == PQLParser.STRING:
        return f"string {token.text}"
    return f"'{token.text}'"


def _display(token_type):
    return TOKEN_DISPLAY.get(token_type) or PQLParser.literalNames[token_type]


def _field_name(token):
    return FIELD_ALIASES.get(token.text.lower(), token.text.lower())


def _check_field(source, token):
    name = _field_name(token)
    if name in FILTER_FIELDS:
        return name
    if name in UNSUPPORTED_FIELDS:
        raise _error(
            source, token, f"field '{token.text}' is not supported: {UNSUPPORTED_FIELDS[name]}", "another field"
        )
    raise _error(source, token, f"unknown field '{token.text}'", "one of " + ", ".join(KNOWN_FIELD_NAMES))


def _unknown_function(source, token):
    return _error(source, token, f"unknown function '{token.text}'", "one of " + ", ".join(sorted(FUNCTIONS.values())))


class _LexerErrors(ErrorListener):
    def __init__(self, source):
        self.source = source

    def syntaxError(self, recognizer, offending_symbol, line, column, msg, e):
        start = recognizer._tokenStartCharIndex
        char = self.source[start]
        if char in "\"'":
            raise PQLSyntaxError(
                "unterminated string literal",
                self.source,
                start,
                token=self.source[start:],
                expected=f"a closing {char}",
            )
        raise PQLSyntaxError(
            f"unexpected character '{char}'",
            self.source,
            start,
            token=char,
            expected="a field name, an operator or a boolean keyword",
        )


class _ParserErrors(ErrorListener):
    def __init__(self, source):
        self.source = source

    def syntaxError(self, recognizer, offending, line, column, msg, e):
        if offending.type == Token.EOF and offending.tokenIndex == 0:
            raise _error(self.source, offending, "empty query", "a filter expression")
        expected = set(e.getExpectedTokens() if e is not None else recognizer.getExpectedTokens())
        previous = recognizer.getTokenStream().get(offending.tokenIndex - 1) if offending.tokenIndex > 0 else None
        detail = f"unexpected {_describe(offending)}"
        field_position = PQLParser.IDENT in expected and PQLParser.NOT in expected
        value_position = PQLParser.IDENT in expected and PQLParser.NOT not in expected
        if offending.type in RESERVED_TOKENS and field_position:
            raise _error(
                self.source,
                offending,
                f"'{offending.text}' is a keyword, not a field name",
                "a field name, 'not' or '('",
            )
        if offending.type in RESERVED_TOKENS and value_position:
            hint = "'is null' to test for an unset field" if offending.type == PQLParser.NULL else "a value"
            raise _error(self.source, offending, f"'{offending.text}' is a keyword, not a value", hint)
        if offending.type == PQLParser.DURATION and value_position:
            raise _error(self.source, offending, "a duration is only allowed after now()", "a value such as now() - 7d")
        if field_position:
            raise _error(self.source, offending, detail, "a field name, 'not' or '('")
        if value_position:
            raise _error(self.source, offending, detail, "a value")
        if expected == {PQLParser.LPAREN} and previous is not None and previous.type in FUNCTION_TOKENS:
            raise _error(self.source, offending, detail, f"'(' after the reserved function name '{previous.text}'")
        names = [_display(token_type) for token_type in sorted(expected, key=lambda t: (t < PQLParser.NEQ, t))]
        if isinstance(recognizer._ctx, (PQLParser.QueryContext, PQLParser.PrimaryContext)):
            names = ["'and'", "'or'", *names]
        raise _error(self.source, offending, detail, names[0] if len(names) == 1 else "one of " + ", ".join(names))


class _SyntaxChecks(PQLListener):
    """Checks that must fire at the token they concern, before the parser moves on."""

    def __init__(self, parser, source):
        self.parser = parser
        self.source = source
        self.depth = 0

    def enterNotExpr(self, ctx):
        if self.depth >= MAX_PQL_DEPTH:
            raise _error(
                self.source,
                self.parser.getCurrentToken(),
                f"expression is nested deeper than {MAX_PQL_DEPTH} levels",
                "a shallower expression",
            )
        self.depth += 1

    def exitNotExpr(self, ctx):
        self.depth -= 1

    def exitFieldName(self, ctx):
        if self.parser.getCurrentToken().type == PQLParser.LPAREN:
            raise _unknown_function(self.source, ctx.start)
        _check_field(self.source, ctx.start)

    def exitIdentValue(self, ctx):
        if self.parser.getCurrentToken().type == PQLParser.LPAREN:
            raise _unknown_function(self.source, ctx.start)


class _AstBuilder(PQLVisitor):
    def __init__(self, source):
        self.source = source
        self.spans = []

    def visitQuery(self, ctx):
        return self.visit(ctx.expression())

    def visitExpression(self, ctx):
        return self.visit(ctx.orExpr())

    def visitOrExpr(self, ctx):
        members = [self.visit(child) for child in ctx.andExpr()]
        return members[0] if len(members) == 1 else {"or": members}

    def visitAndExpr(self, ctx):
        members = [self.visit(child) for child in ctx.notExpr()]
        return members[0] if len(members) == 1 else {"and": members}

    def visitNotExpr(self, ctx):
        if ctx.NOT() is not None:
            return {"not": [self.visit(ctx.notExpr())]}
        return self.visit(ctx.primary())

    def visitPrimary(self, ctx):
        if ctx.expression() is not None:
            return self.visit(ctx.expression())
        return self.visit(ctx.getChild(0))

    def visitPredicate(self, ctx):
        if ctx.fieldName() is None:
            return self.visit(ctx.conditionFunction())
        name = _field_name(ctx.fieldName().start)
        self._span(name, ctx.fieldName())
        return self._comparison(ctx.comparison(), name, FILTER_FIELDS[name])

    def visitCustomPropertyPredicate(self, ctx):
        key_token = ctx.propertyReference().STRING().symbol
        key = self._unescape(key_token)
        if not key.strip():
            raise self._error(key_token, "empty custom property reference", "a property id or name")
        name = f"{CUSTOM_PROPERTY_PREFIX}{key.strip()}"
        self._span(name, ctx.propertyReference())
        return self._comparison(ctx.comparison(), name, None)

    def _comparison(self, ctx, name, field):
        if isinstance(ctx, PQLParser.CompareOperatorContext):
            operator = ctx.operator().start
            lookup, negated = OPERATOR_LOOKUPS[operator.text]
            self._check_lookup(field, name, lookup, operator)
            leaf = {_leaf_key(name, lookup): self._located(name, ctx.value())}
            return {"not": [leaf]} if negated else leaf
        if isinstance(ctx, PQLParser.InListContext):
            self._check_lookup(field, name, IN, ctx.start)
            return {_leaf_key(name, IN): self._value_list(name, ctx.valueList())}
        if isinstance(ctx, PQLParser.NotInListContext):
            self._check_lookup(field, name, IN, ctx.start)
            return {"not": [{_leaf_key(name, IN): self._value_list(name, ctx.valueList())}]}
        self._check_lookup(field, name, ISNULL, ctx.start)
        return {_leaf_key(name, ISNULL): ctx.NOT() is None}

    def _value_list(self, name, ctx):
        values = ctx.value()
        if not values:
            raise self._error(ctx.RPAREN().symbol, "empty value list", "at least one value")
        return [self._located(name, value) for value in values]

    def _span(self, name, ctx, value=None, is_value=False):
        start, stop = ctx.start.start, ctx.stop.stop + 1
        self.spans.append(Span(name, start, self.source[start:stop], value, is_value))

    def _located(self, name, ctx):
        value = self.visit(ctx)
        self._span(name, ctx, value, is_value=True)
        return value

    def _arguments(self, ctx):
        return ctx.arguments().value() if ctx.arguments() is not None else []

    def visitConditionFunction(self, ctx):
        token = ctx.functionName().start
        name = FUNCTIONS[token.text.lower()]
        if name not in IDENTIFIER_FUNCTIONS:
            raise self._error(token, f"{name}() is a value, not a condition", "a field name before it")
        arguments = self._arguments(ctx.callArguments())
        values = [self.visit(argument) for argument in arguments]
        if len(values) != 1:
            raise self._error(
                token,
                f"{name}() takes exactly one argument, got {len(values)}",
                f'a quoted work item identifier such as {name}("PROJ-12")',
            )
        if not isinstance(arguments[0], PQLParser.StringValueContext):
            raise self._error(arguments[0].start, f"{name}() takes a quoted work item identifier", "a string literal")
        self._span(IDENTIFIER_FUNCTION_FIELDS[name], arguments[0], values[0], is_value=True)
        return {IDENTIFIER_FUNCTIONS[name]: values[0]}

    def visitStringValue(self, ctx):
        return self._unescape(ctx.STRING().symbol)

    def visitNumberValue(self, ctx):
        text = ctx.NUMBER().getText()
        number = float(text) if "." in text else int(text)
        return -number if ctx.MINUS() is not None else number

    def visitIdentValue(self, ctx):
        return ctx.getText()

    def visitFunctionValue(self, ctx):
        call = ctx.valueFunction()
        token = call.functionName().start
        name = FUNCTIONS[token.text.lower()]
        if name not in VALUE_FUNCTIONS:
            raise self._error(token, f"{name}() is a condition, not a value", "one of " + ", ".join(VALUE_FUNCTIONS))
        arguments = self._arguments(call.callArguments())
        for argument in arguments:
            self.visit(argument)
        if arguments:
            raise self._error(token, f"{name}() takes no arguments, got {len(arguments)}", f"{name}()")
        offsets = ctx.durationOffset()
        if name == "currentUser":
            if offsets:
                raise self._error(
                    offsets[0].start, f"unexpected {_describe(offsets[0].start)}", "one of 'and', 'or', end of input"
                )
            return {CURRENT_USER_PLACEHOLDER: True}
        seconds = 0
        for offset in offsets:
            sign = -1 if offset.sign().MINUS() is not None else 1
            seconds += sign * self._duration(offset.DURATION().symbol)
        return {NOW_PLACEHOLDER: {"seconds": seconds}}

    def _duration(self, token):
        digits = len(token.text) - len(token.text.lstrip("0123456789"))
        unit = token.text[digits:].lower()
        if unit not in DURATION_UNITS:
            raise PQLSyntaxError(
                f"unknown duration unit '{unit}'",
                self.source,
                token.start + digits,
                token=unit,
                expected="one of " + ", ".join(sorted(DURATION_UNITS)),
            )
        return int(token.text[:digits]) * DURATION_UNITS[unit]

    def _unescape(self, token):
        body = token.text[1:-1]
        parts = []
        cursor = 0
        while cursor < len(body):
            char = body[cursor]
            if char != "\\":
                parts.append(char)
                cursor += 1
                continue
            escape = body[cursor + 1]
            if escape not in ESCAPES:
                raise PQLSyntaxError(
                    f"unknown escape sequence '\\{escape}'",
                    self.source,
                    token.start + 1 + cursor,
                    token=f"\\{escape}",
                    expected="one of " + ", ".join("\\" + key for key in ESCAPES),
                )
            parts.append(ESCAPES[escape])
            cursor += 2
        return "".join(parts)

    def _check_lookup(self, field, name, lookup, token):
        if field is not None and lookup not in field.lookups:
            raise self._error(
                token,
                f"operator '{token.text}' is not supported on field '{name}'",
                "one of " + ", ".join(operators_for(field)),
            )

    def _error(self, token, detail, expected=None):
        return _error(self.source, token, detail, expected)


def _leaf_key(name, lookup):
    return name if lookup == EXACT else f"{name}__{lookup}"


def operators_for(field):
    """The PQL operators a field supports, in display order."""
    return [symbol for symbol, lookup, _ in PQL_OPERATORS if lookup in field.lookups]
