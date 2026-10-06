// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { type Diagnostic, forEachDiagnostic, linter } from "@codemirror/lint";
import type { EditorState, Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import type { PqlSyntaxError } from "./parse.js";
import { parseField, parsed } from "./state.js";

export type SemanticError = { position?: number | null; token?: string | null; message: string };

export type LintOptions = {
  // Semantic validation, usually the validate endpoint; null means the query is valid.
  validate?: (query: string) => Promise<SemanticError | null>;
  validateDelay?: number;
  // A syntax error shows after this many ms without input, so a query being typed is not flagged.
  syntaxDelay?: number;
  onDiagnostics?: (diagnostics: Diagnostic[]) => void;
};

// Marks a diagnostic without a position; it spans the query but draws no underline.
export const unplacedClass = "cm-pql-unplaced";

export function diagnostic(source: string, error: SemanticError | PqlSyntaxError): Diagnostic {
  if (error.position == null) {
    return {
      from: 0,
      to: source.length,
      severity: "error",
      message: error.message,
      source: "pql",
      markClass: unplacedClass,
    };
  }
  const from = Math.max(0, Math.min(error.position, source.length));
  const to = Math.min(source.length, error.token ? from + error.token.length : from + 1);
  return { from, to: Math.max(from, to), severity: "error", message: error.message, source: "pql" };
}

export function syntaxDiagnostics(state: EditorState): Diagnostic[] {
  const source = state.doc.toString();
  if (!source.trim()) return [];
  const error = parsed(state).error;
  return error ? [diagnostic(source, error)] : [];
}

export function diagnosticsKey(diagnostics: readonly Diagnostic[]): string {
  return JSON.stringify(diagnostics.map((d) => [d.from, d.to, d.message]));
}

// Syntax errors wait `syntaxDelay` ms and the validator `validateDelay` ms without newer input.
export function lintSource(options: LintOptions) {
  let latest = 0;
  return (view: { state: EditorState }): Diagnostic[] | Promise<Diagnostic[]> => {
    const state = view.state;
    const source = state.doc.toString();
    const syntax = syntaxDiagnostics(state);
    const validate = options.validate;
    const run = ++latest;
    if (syntax.length === 0 && (!validate || !source.trim())) return [];
    const delay = syntax.length > 0 ? (options.syntaxDelay ?? 700) : (options.validateDelay ?? 400);
    return new Promise((resolve) => {
      setTimeout(async () => {
        if (run !== latest) return resolve([]);
        if (syntax.length > 0 || !validate) return resolve(syntax);
        const error = await validate(source);
        resolve(run === latest && error ? [diagnostic(source, error)] : []);
      }, delay);
    });
  };
}

export function pqlLinter(options: LintOptions = {}): Extension {
  const extensions: Extension[] = [
    parseField,
    linter(lintSource(options), { delay: 0 }),
    EditorView.baseTheme({ [`.cm-lintRange.${unplacedClass}`]: { backgroundImage: "none", textDecoration: "none" } }),
  ];
  const onDiagnostics = options.onDiagnostics;
  if (onDiagnostics) {
    let last = "";
    extensions.push(
      EditorView.updateListener.of((update) => {
        const diagnostics: Diagnostic[] = [];
        forEachDiagnostic(update.state, (d) => diagnostics.push(d));
        const key = diagnosticsKey(diagnostics);
        if (key === last) return;
        last = key;
        onDiagnostics(diagnostics);
      })
    );
  }
  return extensions;
}
