// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { type Diagnostic, forEachDiagnostic, linter } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import { syntaxError } from "./parse.js";

export type SemanticError = { position?: number | null; token?: string | null; message: string };

export type LintOptions = {
  // Semantic validation, usually the validate endpoint; null means the query is valid.
  validate?: (query: string) => Promise<SemanticError | null>;
  validateDelay?: number;
  onDiagnostics?: (diagnostics: Diagnostic[]) => void;
};

function diagnostic(
  source: string,
  position: number | null | undefined,
  token: string | null | undefined,
  message: string
): Diagnostic {
  const from = Math.max(0, Math.min(position ?? 0, source.length));
  const to = Math.min(source.length, token ? from + token.length : from + 1);
  return { from, to: Math.max(from, to), severity: "error", message, source: "pql" };
}

export function syntaxDiagnostics(source: string): Diagnostic[] {
  if (!source.trim()) return [];
  const error = syntaxError(source);
  return error ? [diagnostic(source, error.position, error.token, error.message)] : [];
}

export function pqlLinter(options: LintOptions = {}): Extension {
  const extensions: Extension[] = [linter((view) => syntaxDiagnostics(view.state.doc.toString()), { delay: 0 })];
  const validate = options.validate;
  if (validate) {
    extensions.push(
      linter(
        async (view) => {
          const source = view.state.doc.toString();
          if (!source.trim() || syntaxError(source)) return [];
          const error = await validate(source);
          return error ? [diagnostic(source, error.position, error.token, error.message)] : [];
        },
        { delay: options.validateDelay ?? 400 }
      )
    );
  }
  const onDiagnostics = options.onDiagnostics;
  if (onDiagnostics) {
    let last = "";
    extensions.push(
      EditorView.updateListener.of((update) => {
        const diagnostics: Diagnostic[] = [];
        forEachDiagnostic(update.state, (d) => diagnostics.push(d));
        const key = JSON.stringify(diagnostics.map((d) => [d.from, d.to, d.message]));
        if (key === last) return;
        last = key;
        onDiagnostics(diagnostics);
      })
    );
  }
  return extensions;
}
