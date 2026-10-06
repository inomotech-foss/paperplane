// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useEffect, useRef, useState } from "react";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, placeholder as placeholderExtension } from "@codemirror/view";
import { tags } from "@lezer/highlight";
// plane imports
import { pql, type PqlOptions, type Vocabulary } from "@plane/pql";
import { cn } from "@plane/utils";

type Props = PqlOptions & {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  hasError: boolean;
  className?: string;
};

const highlightStyle = HighlightStyle.define([
  { tag: tags.keyword, class: "text-accent-primary" },
  { tag: tags.function(tags.variableName), class: "text-accent-secondary" },
  { tag: tags.propertyName, class: "font-medium text-primary" },
  { tag: tags.atom, class: "text-secondary" },
  { tag: tags.string, class: "text-success-primary" },
  { tag: tags.number, class: "text-warning-primary" },
  { tag: tags.operator, class: "text-tertiary" },
  { tag: tags.punctuation, class: "text-tertiary" },
]);

const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "inherit", backgroundColor: "transparent" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "inherit", overflow: "hidden" },
  ".cm-content": { padding: "0", caretColor: "currentColor" },
  ".cm-line": { padding: "0" },
  ".cm-placeholder": { color: "var(--text-color-placeholder)" },
  ".cm-lintRange-error": { textDecoration: "underline wavy var(--text-color-danger-primary)", backgroundImage: "none" },
  ".cm-tooltip": { zIndex: "50" },
});

/** The CodeMirror view behind the query bar; loaded lazily, so it owns every CodeMirror import. */
export default function QueryEditor(props: Props) {
  const { value, onChange, placeholder, ariaLabel, hasError, className, vocabulary, ...callbacks } = props;
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const [language] = useState(() => new Compartment());
  // Callbacks are read through this ref, so the extensions are only rebuilt when the vocabulary changes.
  const latest = useRef({ onChange, callbacks });
  useEffect(() => {
    latest.current = { onChange, callbacks };
  });

  const extensionsFor = (words: Vocabulary) =>
    pql({
      vocabulary: words,
      validate: async (query) => (await latest.current.callbacks.validate?.(query)) ?? null,
      onDiagnostics: (diagnostics) => latest.current.callbacks.onDiagnostics?.(diagnostics),
      onSubmit: (editor) => latest.current.callbacks.onSubmit?.(editor),
      onCancel: (editor) => latest.current.callbacks.onCancel?.(editor),
    });

  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          theme,
          syntaxHighlighting(highlightStyle),
          placeholderExtension(placeholder),
          language.of(extensionsFor(vocabulary)),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) latest.current.onChange(update.state.doc.toString());
          }),
          EditorView.contentAttributes.of({ "aria-label": ariaLabel, spellcheck: "false", autocorrect: "off" }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    view.current?.dispatch({ effects: language.reconfigure(extensionsFor(vocabulary)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocabulary]);

  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const current = editor.state.doc.toString();
    if (current !== value) editor.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  return (
    <div
      ref={host}
      className={cn(
        "font-mono flex h-7 w-full min-w-0 flex-1 items-center rounded-sm border bg-layer-1 px-2 text-12 text-primary focus-within:border-accent-strong",
        hasError ? "border-danger-strong" : "border-subtle-1",
        className
      )}
    />
  );
}
