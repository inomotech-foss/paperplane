# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.


class PQLSyntaxError(Exception):
    """A rejected PQL string, with the source position a client has to fix."""

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
