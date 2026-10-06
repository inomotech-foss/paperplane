// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import {
  type ATNSimulator,
  BaseErrorListener,
  CharStream,
  CommonTokenStream,
  Lexer,
  Parser,
  type RecognitionException,
  type Recognizer,
  Token,
} from "antlr4ng";

import { PQLLexer } from "./generated/PQLLexer.js";
import { PQLParser, PrimaryContext, QueryContext } from "./generated/PQLParser.js";

export type PqlSyntaxError = {
  position: number;
  token: string | null;
  detail: string;
  expected: string | null;
  message: string;
};

export type ParseResult = {
  tree: QueryContext;
  tokens: Token[];
  error: PqlSyntaxError | null;
};

const P = PQLParser;

export const KEYWORD_TOKENS = new Set([P.AND, P.OR, P.NOT, P.IN, P.IS, P.NULL]);
export const FUNCTION_TOKENS = new Set([P.CURRENTUSER, P.NOW, P.CHILDOF, P.DESCENDANTOF]);
export const OPERATOR_TOKENS = new Set([P.EQ, P.NEQ, P.GT, P.GTE, P.LT, P.LTE, P.TILDE]);
const RESERVED_TOKENS = new Set([...KEYWORD_TOKENS, P.CF, ...FUNCTION_TOKENS]);

const TOKEN_DISPLAY: Record<number, string> = {
  [Token.EOF]: "end of input",
  [P.IDENT]: "an identifier",
  [P.STRING]: "a string",
  [P.NUMBER]: "a number",
  [P.DURATION]: "a duration",
};

export function tokenName(type: number): string {
  if (type === Token.EOF) return "EOF";
  return PQLLexer.symbolicNames[type] ?? PQLLexer.literalNames[type] ?? String(type);
}

function display(type: number): string {
  return TOKEN_DISPLAY[type] ?? P.literalNames[type] ?? tokenName(type);
}

function describe(token: Token): string {
  if (token.type === Token.EOF) return "end of input";
  if (token.type === P.STRING) return `string ${token.text}`;
  return `'${token.text}'`;
}

function error(
  source: string,
  position: number,
  token: string | null,
  detail: string,
  expected: string | null
): PqlSyntaxError {
  position = Math.max(0, Math.min(position, source.length));
  return { position, token, detail, expected, message: expected ? `${detail}; expected ${expected}` : detail };
}

function lexerError(source: string, lexer: Lexer): PqlSyntaxError {
  const start = lexer.tokenStartCharIndex;
  const char = source[start] ?? "";
  if (char === '"' || char === "'") {
    return error(source, start, source.slice(start), "unterminated string literal", `a closing ${char}`);
  }
  return error(source, start, char, `unexpected character '${char}'`, "a field name, an operator or a boolean keyword");
}

function parserError(source: string, parser: Parser, offending: Token, e: RecognitionException | null): PqlSyntaxError {
  const position = offending.start;
  const text = offending.type === Token.EOF ? null : (offending.text ?? "");
  if (offending.type === Token.EOF && offending.tokenIndex === 0) {
    return error(source, position, text, "empty query", "a filter expression");
  }
  const expected = new Set((e?.getExpectedTokens() ?? parser.getExpectedTokens()).toArray());
  const previous = offending.tokenIndex > 0 ? parser.tokenStream.get(offending.tokenIndex - 1) : null;
  const detail = `unexpected ${describe(offending)}`;
  const fieldPosition = expected.has(P.IDENT) && expected.has(P.NOT);
  const valuePosition = expected.has(P.IDENT) && !expected.has(P.NOT);
  if (RESERVED_TOKENS.has(offending.type) && fieldPosition) {
    return error(source, position, text, `'${text}' is a keyword, not a field name`, "a field name, 'not' or '('");
  }
  if (RESERVED_TOKENS.has(offending.type) && valuePosition) {
    const hint = offending.type === P.NULL ? "'is null' to test for an unset field" : "a value";
    return error(source, position, text, `'${text}' is a keyword, not a value`, hint);
  }
  if (offending.type === P.DURATION && valuePosition) {
    return error(source, position, text, "a duration is only allowed after now()", "a value such as now() - 7d");
  }
  if (fieldPosition) return error(source, position, text, detail, "a field name, 'not' or '('");
  if (valuePosition) return error(source, position, text, detail, "a value");
  if (expected.size === 1 && expected.has(P.LPAREN) && previous && FUNCTION_TOKENS.has(previous.type)) {
    return error(source, position, text, detail, `'(' after the reserved function name '${previous.text}'`);
  }
  const ordered = [...expected].toSorted((a, b) => Number(a < P.NEQ) - Number(b < P.NEQ) || a - b);
  let names = ordered.map(display);
  const ctx = parser.context;
  if (ctx instanceof QueryContext || ctx instanceof PrimaryContext) names = ["'and'", "'or'", ...names];
  return error(source, position, text, detail, names.length === 1 ? names[0]! : `one of ${names.join(", ")}`);
}

class FirstError extends BaseErrorListener {
  error: PqlSyntaxError | null = null;

  constructor(private readonly source: string) {
    super();
  }

  override syntaxError<S extends Token, T extends ATNSimulator>(
    recognizer: Recognizer<T>,
    offending: S | null,
    _line: number,
    _column: number,
    _msg: string,
    e: RecognitionException | null
  ): void {
    if (this.error) return;
    if (recognizer instanceof Lexer) this.error = lexerError(this.source, recognizer);
    else if (recognizer instanceof Parser && offending) this.error = parserError(this.source, recognizer, offending, e);
  }
}

export function tokenize(source: string): Token[] {
  const lexer = new PQLLexer(CharStream.fromString(source));
  lexer.removeErrorListeners();
  const stream = new CommonTokenStream(lexer);
  stream.fill();
  return stream.getTokens();
}

// Parses with error recovery, so the tree is usable while the query is still being typed.
export function parseQuery(source: string): ParseResult {
  const errors = new FirstError(source);
  const lexer = new PQLLexer(CharStream.fromString(source));
  lexer.removeErrorListeners();
  lexer.addErrorListener(errors);
  const stream = new CommonTokenStream(lexer);
  const parser = new PQLParser(stream);
  parser.removeErrorListeners();
  parser.addErrorListener(errors);
  const tree = parser.query();
  return { tree, tokens: stream.getTokens(), error: errors.error };
}

export function syntaxError(source: string): PqlSyntaxError | null {
  return parseQuery(source).error;
}
