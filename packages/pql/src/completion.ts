// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { Completion, CompletionContext, CompletionResult, CompletionSource } from "@codemirror/autocomplete";
import { CodeCompletionCore } from "antlr4-c3";
import { CharStream, CommonTokenStream, type ParserRuleContext, ParseTreeWalker, Token } from "antlr4ng";

import { PQLLexer } from "./generated/PQLLexer.js";
import { PQLListener } from "./generated/PQLListener.js";
import { type CustomPropertyPredicateContext, PQLParser, type PredicateContext } from "./generated/PQLParser.js";
import { FUNCTION_TOKENS, KEYWORD_TOKENS, OPERATOR_TOKENS, parseQuery } from "./parse.js";
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
  tokens: Token[];
  tokenCandidates: Set<number>;
  // Preferred rule -> token index where it starts.
  rules: Map<number, number>;
};

// The predicate the caret sits in: a field name, or a custom property reference.
export type Subject = { field: string | null; property: string | null };

const PREFERRED_RULES = new Set([P.RULE_fieldName, P.RULE_operator, P.RULE_value, P.RULE_propertyReference]);
const WORD_RE = /^[\p{L}_][\p{L}\p{N}_]*$/u;
const DURATION_EXAMPLES = ["1d", "7d", "2w", "12h"];

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

export function positionAt(source: string, caret = source.length): Position {
  const lexer = new PQLLexer(CharStream.fromString(source));
  lexer.removeErrorListeners();
  const stream = new CommonTokenStream(lexer);
  stream.fill();
  const parser = new PQLParser(stream);
  parser.removeErrorListeners();
  const tokens = stream.getTokens();
  const index = caretTokenIndex(tokens, caret);
  // Preferred rules absorb the tokens inside them, so the token pass runs without them.
  const tokenCore = new CodeCompletionCore(parser);
  const ruleCore = new CodeCompletionCore(parser);
  ruleCore.preferredRules = PREFERRED_RULES;
  return {
    caretTokenIndex: index,
    tokens,
    tokenCandidates: new Set(tokenCore.collectCandidates(index).tokens.keys()),
    rules: new Map([...ruleCore.collectCandidates(index).rules].map(([rule, info]) => [rule, info.startTokenIndex])),
  };
}

class PredicateFinder extends PQLListener {
  found: PredicateContext | CustomPropertyPredicateContext | null = null;

  constructor(private readonly index: number) {
    super();
  }

  private consider(ctx: ParserRuleContext) {
    const start = ctx.start?.tokenIndex ?? Infinity;
    const stop = ctx.stop?.tokenIndex ?? Infinity;
    if (start < this.index && stop >= this.index - 1) this.found = ctx as PredicateContext;
  }

  override enterPredicate = (ctx: PredicateContext): void => this.consider(ctx);
  override enterCustomPropertyPredicate = (ctx: CustomPropertyPredicateContext): void => this.consider(ctx);
}

export function subjectAt(source: string, tokenIndex: number): Subject {
  const finder = new PredicateFinder(tokenIndex);
  ParseTreeWalker.DEFAULT.walk(finder, parseQuery(source).tree);
  const found = finder.found;
  if (!found) return { field: null, property: null };
  if ("fieldName" in found) return { field: found.fieldName()?.getText() ?? null, property: null };
  const reference = found.propertyReference().getText();
  return { field: null, property: reference.slice(1, -1) };
}

export function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function bareOrQuoted(value: string): string {
  return WORD_RE.test(value) ? value : quote(value);
}

// Operators the grammar allows here, in the field's display order or, without a field, the vocabulary's.
function operatorCandidates(position: Position, vocabulary: Vocabulary, field: FieldInfo | undefined): string[] {
  const allowed = new Set<string>();
  for (const type of position.tokenCandidates) {
    if (OPERATOR_TOKENS.has(type)) allowed.add(P.literalNames[type]!.slice(1, -1));
    if (type === P.IN) allowed.add("in");
    if (type === P.NOT) allowed.add("not in");
    if (type === P.IS) allowed.add("is null").add("is not null");
  }
  const ordered = field ? field.operators : [...new Set(vocabulary.fields.flatMap((f) => f.operators))];
  return ordered.filter((operator) => allowed.has(operator));
}

function valueFunctions(vocabulary: Vocabulary, field: FieldInfo | undefined): Candidate[] {
  const options: Candidate[] = [];
  for (const { name, kind } of vocabulary.functions) {
    if (kind !== "value") continue;
    if (name === "currentUser" && !field?.people) continue;
    if (name === "now" && field?.type !== "date") continue;
    options.push({ label: `${name}()`, insert: `${name}()`, type: "function", boost: 1 });
    if (name === "now") options.push({ label: "now() - 7d", insert: "now() - 7d", type: "function" });
  }
  return options;
}

async function valueCandidates(
  vocabulary: Vocabulary,
  subject: Subject,
  prefix: string,
  closer: string
): Promise<Candidate[]> {
  const field = subject.field ? findField(vocabulary, subject.field) : undefined;
  const options: Candidate[] = [];
  for (const choice of field?.choices ?? []) {
    options.push({ label: choice, insert: closer ? choice + closer : bareOrQuoted(choice), type: "value" });
  }
  options.push(...valueFunctions(vocabulary, field));
  if (field && !field.choices && vocabulary.valuesFor) {
    for (const name of await vocabulary.valuesFor(field.name, prefix)) {
      options.push({ label: name, insert: closer ? name + closer : quote(name), type: "value" });
    }
  }
  return options;
}

// Lookup paths such as `labels__id` still parse, but rank below the names people type.
function fieldBoost(name: string, index: number): number {
  if (name.includes("__")) return -1;
  return index === 0 ? 1 : 0;
}

function fieldCandidates(vocabulary: Vocabulary, position: Position): Candidate[] {
  const options: Candidate[] = [];
  for (const field of vocabulary.fields) {
    const names = [...new Set([...field.aliases, field.name])];
    names.forEach((name, i) => options.push({ label: name, insert: name, type: "field", boost: fieldBoost(name, i) }));
  }
  if (position.tokenCandidates.has(P.NOT)) options.push({ label: "not", insert: "not ", type: "keyword" });
  if (position.tokenCandidates.has(P.CF)) options.push({ label: 'cf[""]', insert: 'cf[""]', type: "field", cursor: 4 });
  for (const { name, kind } of vocabulary.functions) {
    if (kind === "condition") {
      options.push({ label: `${name}("")`, insert: `${name}("")`, type: "function", cursor: name.length + 2 });
    }
  }
  return options;
}

export async function candidatesAt(source: string, caret: number, vocabulary: Vocabulary): Promise<Candidates> {
  const position = positionAt(source, caret);
  const { tokens, caretTokenIndex: index } = position;
  const caretToken = tokens[index]!;
  const inWord = caretToken.type !== Token.EOF && caretToken.start < caret;
  const inLiteral = tokens.some((t) => !isWordLike(t) && t.type !== Token.EOF && t.start < caret && caret <= t.stop);
  if (inLiteral) return { from: caret, options: [] };
  let from = inWord ? caretToken.start : caret;
  // The lexer drops an unterminated string, so an open quote only shows in the source.
  const gapStart = index > 0 ? tokens[index - 1]!.stop + 1 : 0;
  const openQuote = inWord ? -1 : source.slice(gapStart, caret).search(/["']/);
  const closer = openQuote >= 0 ? source[gapStart + openQuote]! : "";
  if (openQuote >= 0) from = gapStart + openQuote + 1;
  const prefix = source.slice(from, caret);
  const spaced = (text: string) => (from === caret && caret > 0 && !/\s/.test(source[caret - 1]!) ? ` ${text}` : text);
  const options: Candidate[] = [];
  const valueStartsHere = position.rules.get(P.RULE_value) === index;

  if (position.tokenCandidates.has(P.DURATION)) {
    for (const example of DURATION_EXAMPLES) options.push({ label: example, insert: example, type: "value" });
  } else if (position.rules.has(P.RULE_fieldName)) {
    options.push(...fieldCandidates(vocabulary, position));
  } else if (position.rules.has(P.RULE_operator)) {
    const subject = subjectAt(source, index);
    const field = subject.field ? findField(vocabulary, subject.field) : undefined;
    for (const operator of operatorCandidates(position, vocabulary, field)) {
      options.push({
        label: operator,
        insert: spaced(operator.endsWith("in") ? `${operator} (` : `${operator} `),
        type: "operator",
      });
    }
  } else if (position.tokenCandidates.has(P.NULL)) {
    options.push({ label: "null", insert: "null", type: "keyword" });
    if (position.tokenCandidates.has(P.NOT)) options.push({ label: "not null", insert: "not null", type: "keyword" });
  } else if (position.tokenCandidates.has(P.IN)) {
    options.push({ label: "in (", insert: spaced("in ("), type: "operator" });
  } else if (position.rules.has(P.RULE_propertyReference)) {
    for (const name of (await vocabulary.valuesFor?.("cf", prefix)) ?? []) {
      options.push({ label: name, insert: closer ? name + closer : quote(name), type: "value" });
    }
  } else if (valueStartsHere) {
    options.push(...(await valueCandidates(vocabulary, subjectAt(source, index), prefix, closer)));
  }
  if (position.tokenCandidates.has(P.AND) && !valueStartsHere) {
    options.push(
      { label: "and", insert: spaced("and "), type: "keyword" },
      { label: "or", insert: spaced("or "), type: "keyword" }
    );
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
    return { from, options: options.map(toCompletion), validFor: /^[\p{L}\p{N}_ ]*$/u };
  };
}
