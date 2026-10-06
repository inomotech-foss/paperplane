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
  onDiagnostics?: (diagnostics: Diagnostic[]) => void;
};

export function diagnostic(source: string, error: SemanticError | PqlSyntaxError): Diagnostic {
  const from = Math.max(0, Math.min(error.position ?? 0, source.length));
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

// Syntax errors are returned at once; the validator runs after `delay` ms without newer input.
export function lintSource(options: LintOptions) {
  let latest = 0;
  return (view: { state: EditorState }): Diagnostic[] | Promise<Diagnostic[]> => {
    const state = view.state;
    const source = state.doc.toString();
    const syntax = syntaxDiagnostics(state);
    const validate = options.validate;
    if (syntax.length > 0 || !validate || !source.trim()) return syntax;
    const run = ++latest;
    return new Promise((resolve) => {
      setTimeout(async () => {
        if (run !== latest) return resolve([]);
        const error = await validate(source);
        resolve(run === latest && error ? [diagnostic(source, error)] : []);
      }, options.validateDelay ?? 400);
    });
  };
}

export function pqlLinter(options: LintOptions = {}): Extension {
  const extensions: Extension[] = [parseField, linter(lintSource(options), { delay: 0 })];
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
