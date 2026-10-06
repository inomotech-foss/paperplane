// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { Completion, CompletionContext, CompletionResult, CompletionSource } from "@codemirror/autocomplete";
import { CodeCompletionCore } from "antlr4-c3";
import { CharStream, CommonTokenStream, Token } from "antlr4ng";

import { PQLLexer } from "./generated/PQLLexer.js";
import { PQLParser } from "./generated/PQLParser.js";
import { FUNCTION_TOKENS, KEYWORD_TOKENS, OPERATOR_TOKENS } from "./parse.js";
import { type FieldInfo, type Vocabulary, findField } from "./vocabulary.js";

const P = PQLParser;

export type Candidate = {
  label: string;
  insert: string;
  type: "field" | "operator" | "value" | "function" | "keyword";
  // Caret offset inside `insert` after applying it, when not at its end.
  cursor?: number;
  boost?: number;
};

export type Candidates = {
  from: number;
  options: Candidate[];
};

export type Position = {
  caretTokenIndex: number;
  tokens: Set<number>;
  rules: Set<number>;
};

const PREFERRED_RULES = new Set([P.RULE_fieldName, P.RULE_operator, P.RULE_value, P.RULE_propertyReference]);
const CONDITION_FUNCTIONS: Record<number, string> = { [P.CHILDOF]: "childOf", [P.DESCENDANTOF]: "descendantOf" };
const WORD_RE = /^[\p{L}_][\p{L}\p{N}_]*$/u;
const DURATION_EXAMPLES = ["1d", "7d", "2w", "12h"];

const LOOKUP_OPERATORS: Record<string, string[]> = {
  exact: ["=", "!="],
  gt: [">"],
  gte: [">="],
  lt: ["<"],
  lte: ["<="],
  icontains: ["~"],
  in: ["in (", "not in ("],
  isnull: ["is null", "is not null"],
};
const ALL_OPERATORS = ["=", "!=", ">", ">=", "<", "<=", "~", "in (", "not in (", "is null", "is not null"];
const VALUE_TOKENS = new Set([
  P.STRING,
  P.NUMBER,
  P.IDENT,
  P.DURATION,
  P.COMMA,
  P.LPAREN,
  P.RPAREN,
  P.PLUS,
  P.MINUS,
  ...FUNCTION_TOKENS,
]);

function isWordLike(token: Token): boolean {
  return (
    token.type === P.IDENT || KEYWORD_TOKENS.has(token.type) || token.type === P.CF || FUNCTION_TOKENS.has(token.type)
  );
}

// The token c3 is asked about: the one containing the caret when the caret
// touches the end of a word, otherwise the first token at or after the caret.
export function caretTokenIndex(tokens: Token[], caret: number): number {
  for (const token of tokens) {
    if (token.type === Token.EOF) break;
    if (isWordLike(token) && token.start < caret && caret <= token.stop + 1) return token.tokenIndex;
    if (token.start >= caret) return token.tokenIndex;
  }
  return tokens.length - 1;
}

export function positionAt(source: string, caret = source.length): Position & { tokens_: Token[] } {
  const lexer = new PQLLexer(CharStream.fromString(source));
  lexer.removeErrorListeners();
  const stream = new CommonTokenStream(lexer);
  const parser = new PQLParser(stream);
  parser.removeErrorListeners();
  parser.query();
  const tokens = stream.getTokens();
  const index = caretTokenIndex(tokens, caret);
  // c3 reuses one result object per core, so each pass gets its own.
  const tokenCore = new CodeCompletionCore(parser);
  const ruleCore = new CodeCompletionCore(parser);
  ruleCore.preferredRules = PREFERRED_RULES;
  return {
    caretTokenIndex: index,
    tokens: new Set(tokenCore.collectCandidates(index).tokens.keys()),
    rules: new Set(ruleCore.collectCandidates(index).rules.keys()),
    tokens_: tokens,
  };
}

// The field a value or operator belongs to: the IDENT before the operator,
// skipping back over whatever of the value has been typed.
export function fieldBefore(tokens: Token[], index: number, valuePosition: boolean): string | null {
  let i = index - 1;
  if (valuePosition) {
    while (i >= 0 && VALUE_TOKENS.has(tokens[i]!.type)) i--;
    if (i >= 0 && (OPERATOR_TOKENS.has(tokens[i]!.type) || tokens[i]!.type === P.IN)) i--;
    if (i >= 0 && tokens[i]!.type === P.NOT) i--;
  }
  return i >= 0 && tokens[i]!.type === P.IDENT ? (tokens[i]!.text ?? null) : null;
}

export function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function bareOrQuoted(value: string): string {
  return WORD_RE.test(value) ? value : quote(value);
}

function operatorsFor(field: FieldInfo | undefined): string[] {
  if (!field) return ALL_OPERATORS;
  const operators = new Set(field.lookups.flatMap((lookup) => LOOKUP_OPERATORS[lookup] ?? []));
  return ALL_OPERATORS.filter((operator) => operators.has(operator));
}

async function valueCandidates(vocabulary: Vocabulary, fieldName: string | null, prefix: string): Promise<Candidate[]> {
  const field = fieldName ? findField(vocabulary, fieldName) : undefined;
  const options: Candidate[] = [];
  if (field?.choices) {
    for (const choice of field.choices) options.push({ label: choice, insert: bareOrQuoted(choice), type: "value" });
  }
  if (field?.people && vocabulary.functions.includes("currentUser")) {
    options.push({ label: "currentUser()", insert: "currentUser()", type: "function", boost: 1 });
  }
  if (field?.type === "date" && vocabulary.functions.includes("now")) {
    options.push({ label: "now()", insert: "now()", type: "function", boost: 1 });
    options.push({ label: "now() - 7d", insert: "now() - 7d", type: "function" });
  }
  if (field && !field.choices && vocabulary.valuesFor) {
    for (const name of await vocabulary.valuesFor(field.name, prefix)) {
      options.push({ label: name, insert: quote(name), type: "value" });
    }
  }
  return options;
}

function fieldCandidates(vocabulary: Vocabulary, position: Position): Candidate[] {
  const options: Candidate[] = [];
  for (const field of vocabulary.fields) {
    const names = [...new Set([...field.aliases, field.name])];
    names.forEach((name, i) => options.push({ label: name, insert: name, type: "field", boost: i === 0 ? 1 : 0 }));
  }
  if (position.tokens.has(P.NOT)) options.push({ label: "not", insert: "not ", type: "keyword" });
  if (position.tokens.has(P.CF)) options.push({ label: 'cf[""]', insert: 'cf[""]', type: "field", cursor: 4 });
  for (const [type, name] of Object.entries(CONDITION_FUNCTIONS)) {
    if (position.tokens.has(Number(type)) && vocabulary.functions.includes(name)) {
      options.push({ label: `${name}("")`, insert: `${name}("")`, type: "function", cursor: name.length + 2 });
    }
  }
  return options;
}

export async function candidatesAt(source: string, caret: number, vocabulary: Vocabulary): Promise<Candidates> {
  const position = positionAt(source, caret);
  const { tokens_: tokens, caretTokenIndex: index } = position;
  const caretToken = tokens[index]!;
  const inWord = caretToken.type !== Token.EOF && caretToken.start < caret;
  let from = inWord ? caretToken.start : caret;
  // The lexer drops an unterminated string, so an open quote only shows in the source.
  const gapStart = index > 0 ? tokens[index - 1]!.stop + 1 : 0;
  const openQuote = inWord ? -1 : source.slice(gapStart, caret).search(/["']/);
  if (openQuote >= 0) from = gapStart + openQuote;
  const prefix = source.slice(openQuote >= 0 ? from + 1 : from, caret);
  const options: Candidate[] = [];

  if (position.tokens.has(P.DURATION)) {
    for (const example of DURATION_EXAMPLES) options.push({ label: example, insert: example, type: "value" });
  } else if (position.rules.has(P.RULE_fieldName)) {
    options.push(...fieldCandidates(vocabulary, position));
  } else if (position.rules.has(P.RULE_operator)) {
    const field = fieldBefore(tokens, index, false);
    for (const operator of operatorsFor(field ? findField(vocabulary, field) : undefined)) {
      options.push({ label: operator, insert: `${operator} `, type: "operator" });
    }
  } else if (position.tokens.has(P.NULL)) {
    options.push({ label: "null", insert: "null", type: "keyword" });
    if (position.tokens.has(P.NOT)) options.push({ label: "not null", insert: "not null", type: "keyword" });
  } else if (position.tokens.has(P.IN)) {
    options.push({ label: "in (", insert: "in (", type: "operator" });
  } else if (position.rules.has(P.RULE_propertyReference)) {
    for (const name of (await vocabulary.valuesFor?.("cf", prefix)) ?? []) {
      options.push({ label: name, insert: quote(name), type: "value" });
    }
  } else if (position.rules.has(P.RULE_value)) {
    options.push(...(await valueCandidates(vocabulary, fieldBefore(tokens, index, true), prefix)));
  }
  if (position.tokens.has(P.AND) && !position.rules.has(P.RULE_value)) {
    options.push({ label: "and", insert: "and ", type: "keyword" }, { label: "or", insert: "or ", type: "keyword" });
  }
  return { from, options };
}

function toCompletion(candidate: Candidate): Completion {
  const completion: Completion = { label: candidate.label, type: candidate.type };
  if (candidate.boost) completion.boost = candidate.boost;
  if (candidate.cursor === undefined) {
    completion.apply = candidate.insert;
  } else {
    completion.apply = (view, _completion, from, to) => {
      view.dispatch({
        changes: { from, to, insert: candidate.insert },
        selection: { anchor: from + candidate.cursor! },
      });
    };
  }
  return completion;
}

export function pqlCompletionSource(vocabulary: Vocabulary): CompletionSource {
  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    const { from, options } = await candidatesAt(context.state.doc.toString(), context.pos, vocabulary);
    if (context.aborted || options.length === 0) return null;
    return { from, options: options.map(toCompletion), validFor: /^[\p{L}\p{N}_]*$/u };
  };
}
