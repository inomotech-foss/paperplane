// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { autocompletion } from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";

import { pqlCompletionSource } from "./completion.js";
import { pqlHighlighting } from "./highlight.js";
import { type LintOptions, pqlLinter } from "./lint.js";
import { type SingleLineOptions, singleLine } from "./single-line.js";
import type { Vocabulary } from "./vocabulary.js";

export type PqlOptions = LintOptions &
  SingleLineOptions & {
    vocabulary: Vocabulary;
  };

export function pql(options: PqlOptions): Extension[] {
  return [
    pqlHighlighting(),
    pqlLinter(options),
    autocompletion({ override: [pqlCompletionSource(options.vocabulary)], icons: false }),
    singleLine(options),
  ];
}

export { PQLLexer } from "./generated/PQLLexer.js";
export { PQLParser } from "./generated/PQLParser.js";
export { candidatesAt, pqlCompletionSource, type Candidate, type Candidates } from "./completion.js";
export { highlightTokens, pqlHighlighting } from "./highlight.js";
export { pqlLinter, syntaxDiagnostics, type LintOptions, type SemanticError } from "./lint.js";
export { parseQuery, syntaxError, tokenName, tokenize, type ParseResult, type PqlSyntaxError } from "./parse.js";
export { rejectNewlines, singleLine, type SingleLineOptions } from "./single-line.js";
export { findField, type FieldInfo, type Vocabulary } from "./vocabulary.js";
