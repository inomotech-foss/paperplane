# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Tokenizer for Plane Query Language.

PQL is the human-readable surface of the `filters` JSON AST, for example

    priority = "urgent" AND assignee = currentUser()

The tokenizer is deliberately dumb: it recognises literals, identifiers,
punctuation and comparison operators, and leaves every question of meaning to
`plane.utils.pql.parser`. Keywords are not distinguished from identifiers here
because `in`, `is`, `not`, `and` and `or` are only keywords in the positions
the grammar puts them in.

Every token carries its source offsets so the parser can point at the exact
character that broke, which is the whole reason `PQLSyntaxError` exists.
"""

from dataclasses import dataclass

IDENT = "ident"
STRING = "string"
NUMBER = "number"
DURATION = "duration"
OPERATOR = "operator"
LPAREN = "("
RPAREN = ")"
LBRACKET = "["
RBRACKET = "]"
COMMA = ","
PLUS = "+"
MINUS = "-"
EOF = "end of input"

COMPARISON_OPERATORS = ("!=", ">=", "<=", "=", ">", "<", "~")

PUNCTUATION = {"(": LPAREN, ")": RPAREN, "[": LBRACKET, "]": RBRACKET, ",": COMMA, "+": PLUS, "-": MINUS}

ESCAPES = {"\\": "\\", '"': '"', "'": "'", "n": "\n", "r": "\r", "t": "\t"}

# Durations only need whole units; a work item query is never sub-hour precise.
DURATION_UNITS = {"h": 3600, "d": 86400, "w": 604800}


class PQLSyntaxError(Exception):
    """A structured, catchable error describing why a PQL string was rejected.

    Mirrors `FilterCompileError` in spirit but adds the source position, so a
    client (usually an LLM) can see which character it has to fix.
    """

    def __init__(self, detail, source, position, token=None, expected=None):
        position = max(0, min(position, len(source)))
        line, column = line_column(source, position)
        message = f"PQL syntax error at line {line}, column {column} (offset {position}): {detail}"
        if expected:
            message = f"{message}; expected {expected}"
        super().__init__(message)
        self.message = message
        self.detail = detail
        self.position = position
        self.line = line
        self.column = column
        self.token = token
        self.expected = expected

    def as_dict(self):
        return {
            "error": self.message,
            "position": self.position,
            "line": self.line,
            "column": self.column,
            "token": self.token,
            "expected": self.expected,
        }


def line_column(source, position):
    """Turn a character offset into a 1-based line and column."""
    prefix = source[:position]
    line = prefix.count("\n") + 1
    column = position - (prefix.rfind("\n") + 1) + 1
    return line, column


@dataclass(frozen=True)
class Token:
    kind: str
    value: object
    text: str
    start: int
    end: int

    def describe(self):
        if self.kind == EOF:
            return "end of input"
        if self.kind == STRING:
            return f"string {self.text}"
        return f"'{self.text}'"


def tokenize(source):
    """Turn a PQL string into a token list ending in an `EOF` token.

    Raises `PQLSyntaxError` on an unterminated string, an unknown escape or a
    character that cannot start a token.
    """
    tokens = []
    index = 0
    length = len(source)
    while index < length:
        char = source[index]
        if char.isspace():
            index += 1
            continue
        if char in "\"'":
            token, index = _read_string(source, index)
        elif char.isdigit():
            token, index = _read_number(source, index)
        elif char.isalpha() or char == "_":
            token, index = _read_identifier(source, index)
        elif char in PUNCTUATION:
            token = Token(PUNCTUATION[char], char, char, index, index + 1)
            index += 1
        else:
            token, index = _read_operator(source, index)
        tokens.append(token)
    tokens.append(Token(EOF, None, "", length, length))
    return tokens


def _read_operator(source, index):
    for operator in COMPARISON_OPERATORS:
        if source.startswith(operator, index):
            end = index + len(operator)
            return Token(OPERATOR, operator, operator, index, end), end
    raise PQLSyntaxError(
        f"unexpected character '{source[index]}'",
        source,
        index,
        token=source[index],
        expected="a field name, an operator or a boolean keyword",
    )


def _read_identifier(source, index):
    end = index
    while end < len(source) and (source[end].isalnum() or source[end] == "_"):
        end += 1
    text = source[index:end]
    return Token(IDENT, text, text, index, end), end


def _read_number(source, index):
    end = index
    while end < len(source) and source[end].isdigit():
        end += 1
    if end < len(source) and source[end] == "." and end + 1 < len(source) and source[end + 1].isdigit():
        end += 1
        while end < len(source) and source[end].isdigit():
            end += 1
        text = source[index:end]
        return Token(NUMBER, float(text), text, index, end), end

    amount = int(source[index:end])
    unit_end = end
    while unit_end < len(source) and source[unit_end].isalpha():
        unit_end += 1
    if unit_end == end:
        text = source[index:end]
        return Token(NUMBER, amount, text, index, end), end

    unit = source[end:unit_end]
    if unit not in DURATION_UNITS:
        raise PQLSyntaxError(
            f"unknown duration unit '{unit}'",
            source,
            end,
            token=unit,
            expected="one of " + ", ".join(sorted(DURATION_UNITS)),
        )
    text = source[index:unit_end]
    return Token(DURATION, amount * DURATION_UNITS[unit], text, index, unit_end), unit_end


def _read_string(source, index):
    quote = source[index]
    parts = []
    cursor = index + 1
    while cursor < len(source):
        char = source[cursor]
        if char == "\\":
            if cursor + 1 >= len(source):
                break
            escape = source[cursor + 1]
            if escape not in ESCAPES:
                raise PQLSyntaxError(
                    f"unknown escape sequence '\\{escape}'",
                    source,
                    cursor,
                    token=f"\\{escape}",
                    expected="one of " + ", ".join("\\" + key for key in ESCAPES),
                )
            parts.append(ESCAPES[escape])
            cursor += 2
            continue
        if char == quote:
            text = source[index : cursor + 1]
            return Token(STRING, "".join(parts), text, index, cursor + 1), cursor + 1
        parts.append(char)
        cursor += 1
    raise PQLSyntaxError(
        "unterminated string literal",
        source,
        index,
        token=source[index:],
        expected=f"a closing {quote}",
    )
