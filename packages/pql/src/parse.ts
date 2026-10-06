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
import { PQLParser, type QueryContext } from "./generated/PQLParser.js";

export type PqlSyntaxError = {
  position: number;
  token: string | null;
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
  return `'${token.text ?? ""}'`;
}

function lexerError(source: string, lexer: Lexer): PqlSyntaxError {
  const position = lexer.tokenStartCharIndex;
  const char = source[position] ?? "";
  if (char === '"' || char === "'") {
    return { position, token: source.slice(position), message: "unterminated string literal" };
  }
  return { position, token: char, message: `unexpected character '${char}'` };
}

function parserError(parser: Parser, offending: Token, e: RecognitionException | null): PqlSyntaxError {
  const token = offending.type === Token.EOF ? null : (offending.text ?? "");
  if (offending.type === Token.EOF && offending.tokenIndex === 0) {
    return { position: offending.start, token, message: "empty query" };
  }
  const expected = (e?.getExpectedTokens() ?? parser.getExpectedTokens()).toArray().map(display);
  const tail = expected.length === 1 ? expected[0] : `one of ${expected.join(", ")}`;
  return { position: offending.start, token, message: `unexpected ${describe(offending)}; expected ${tail}` };
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
    else if (recognizer instanceof Parser && offending) this.error = parserError(recognizer, offending, e);
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
