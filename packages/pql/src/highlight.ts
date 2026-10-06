// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { highlightingFor } from "@codemirror/language";
import type { EditorState, Extension } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { type Tag, tags } from "@lezer/highlight";
import { ParseTreeWalker, Token } from "antlr4ng";

import { PQLListener } from "./generated/PQLListener.js";
import { type FieldNameContext, PQLParser } from "./generated/PQLParser.js";
import { FUNCTION_TOKENS, KEYWORD_TOKENS, OPERATOR_TOKENS, parseQuery } from "./parse.js";

const P = PQLParser;

const PUNCTUATION = new Set([P.LPAREN, P.RPAREN, P.LBRACKET, P.RBRACKET, P.COMMA]);

class FieldCollector extends PQLListener {
  readonly fields = new Set<number>();

  override enterFieldName = (ctx: FieldNameContext): void => {
    if (ctx.start) this.fields.add(ctx.start.tokenIndex);
  };
}

export function tagFor(token: Token, fieldTokens: Set<number>): Tag | null {
  const type = token.type;
  if (type === Token.EOF) return null;
  if (KEYWORD_TOKENS.has(type) || type === P.CF) return tags.keyword;
  if (FUNCTION_TOKENS.has(type)) return tags.function(tags.variableName);
  if (OPERATOR_TOKENS.has(type) || type === P.PLUS || type === P.MINUS) return tags.operator;
  if (type === P.STRING) return tags.string;
  if (type === P.NUMBER || type === P.DURATION) return tags.number;
  if (PUNCTUATION.has(type)) return tags.punctuation;
  if (type === P.IDENT) return fieldTokens.has(token.tokenIndex) ? tags.propertyName : tags.atom;
  return null;
}

export function highlightTokens(source: string): { token: Token; tag: Tag }[] {
  const { tree, tokens } = parseQuery(source);
  const collector = new FieldCollector();
  ParseTreeWalker.DEFAULT.walk(collector, tree);
  const result: { token: Token; tag: Tag }[] = [];
  for (const token of tokens) {
    const tag = tagFor(token, collector.fields);
    if (tag) result.push({ token, tag });
  }
  return result;
}

function decorate(state: EditorState): DecorationSet {
  const marks = [];
  for (const { token, tag } of highlightTokens(state.doc.toString())) {
    const cls = highlightingFor(state, [tag]);
    if (cls) marks.push(Decoration.mark({ class: cls }).range(token.start, token.stop + 1));
  }
  return Decoration.set(marks, true);
}

export function pqlHighlighting(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = decorate(view.state);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) this.decorations = decorate(update.state);
      }
    },
    { decorations: (plugin) => plugin.decorations }
  );
}
