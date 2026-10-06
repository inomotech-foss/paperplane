# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Dump the Python parser's test queries to fixtures/parity.json.

Syntax errors are taken from the generated parser alone, without the field
and function checks, so the TypeScript parser can be held to the same result.
Run from apps/api with PYTHONPATH=., DJANGO_SETTINGS_MODULE and the usual env.
"""

import json
from pathlib import Path

import django

django.setup()

from antlr4 import CommonTokenStream, InputStream  # noqa: E402

from plane.tests.unit.utils import test_pql_parser as cases  # noqa: E402
from plane.utils.pql import parser  # noqa: E402
from plane.utils.pql.errors import PQLSyntaxError  # noqa: E402
from plane.utils.pql.generated.PQLLexer import PQLLexer  # noqa: E402
from plane.utils.pql.generated.PQLParser import PQLParser  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "fixtures" / "parity.json"


def syntax_error(source):
    lexer = PQLLexer(InputStream(source))
    lexer.removeErrorListeners()
    lexer.addErrorListener(parser._LexerErrors(source))
    antlr_parser = PQLParser(CommonTokenStream(lexer))
    antlr_parser.removeErrorListeners()
    antlr_parser.addErrorListener(parser._ParserErrors(source))
    try:
        antlr_parser.query()
    except PQLSyntaxError as exc:
        return {
            "position": exc.position,
            "token": exc.token,
            "detail": exc.detail,
            "expected": exc.expected,
        }
    return None


def main():
    valid = sorted(
        {
            query
            for query, _ in cases.OPERATOR_CASES
            + cases.FIELD_NAME_CASES
            + cases.FUNCTION_CASES
            + cases.NAME_CASES
            + cases.PRECEDENCE_CASES
            + cases.QUOTING_CASES
            + cases.IN_CASES
            + cases.CUSTOM_PROPERTY_CASES
            + cases.DOCUMENTED_CASES
        }
    )
    invalid = []
    semantic = []
    for query, _, _ in cases.ERROR_CASES + cases.RESERVED_WORD_CASES:
        error = syntax_error(query)
        if error is None:
            semantic.append(query)
        else:
            invalid.append({"query": query, **error})
    for query in valid:
        assert syntax_error(query) is None, query
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(
        json.dumps({"valid": valid, "invalid": invalid, "semantic": semantic}, indent=2)
        + "\n"
    )
    print(
        f"{len(valid)} valid, {len(invalid)} invalid, {len(semantic)} semantic -> {OUT}"
    )


if __name__ == "__main__":
    main()
