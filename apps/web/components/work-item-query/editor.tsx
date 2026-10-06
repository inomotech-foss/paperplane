// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { type RefObject, useEffect, useRef, useState } from "react";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Annotation, Compartment, EditorState } from "@codemirror/state";
import { EditorView, placeholder as placeholderExtension } from "@codemirror/view";
import { tags } from "@lezer/highlight";
// plane imports
import { pql, type PqlOptions, type Vocabulary } from "@plane/pql";
// local imports
import { editorBoxClass } from "./editor-classes";

type Props = PqlOptions & {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  hasError: boolean;
  className?: string;
  // Set by the lazy-load fallback when it was focused; the editor takes focus once it mounts.
  focusOnMount?: RefObject<boolean>;
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

// Colours are propel's raw theme variables; the Tailwind `--*-color-*` aliases are inlined and not defined at runtime.
// The `&.cm-editor` prefix outranks CodeMirror's light and dark base theme selectors.
const theme = EditorView.theme({
  "&": { flex: "1 1 auto", minWidth: "0", fontSize: "inherit", backgroundColor: "transparent" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "inherit", overflowX: "auto", scrollbarWidth: "none" },
  ".cm-scroller::-webkit-scrollbar": { display: "none" },
  ".cm-content": { padding: "0", caretColor: "var(--txt-primary)" },
  ".cm-line": { padding: "0" },
  ".cm-placeholder": { color: "var(--txt-placeholder)" },
  ".cm-lintRange-error": { textDecoration: "underline wavy var(--txt-danger-primary)", backgroundImage: "none" },
  "&.cm-editor .cm-tooltip": {
    zIndex: "50",
    overflow: "hidden",
    border: "1px solid var(--border-subtle)",
    borderRadius: "8px",
    backgroundColor: "var(--bg-layer-1)",
    boxShadow: "var(--shadow-overlay-100)",
    color: "var(--txt-primary)",
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-13)",
    lineHeight: "20px",
  },
  "&.cm-editor .cm-tooltip.cm-tooltip-autocomplete > ul": {
    fontFamily: "inherit",
    minWidth: "12rem",
    maxHeight: "18rem",
    padding: "4px",
  },
  "&.cm-editor .cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    height: "28px",
    padding: "0 8px",
    borderRadius: "6px",
    color: "var(--txt-primary)",
  },
  "&.cm-editor .cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--bg-layer-transparent-hover)",
    color: "var(--txt-primary)",
  },
  "&.cm-editor .cm-completionLabel": { flex: "1 1 auto", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis" },
  "&.cm-editor .cm-completionDetail": { marginLeft: "auto", fontStyle: "normal", color: "var(--txt-tertiary)" },
  "&.cm-editor .cm-completionMatchedText": { textDecoration: "none", fontWeight: "600" },
  "&.cm-editor .cm-tooltip.cm-tooltip-lint": { padding: "4px", maxWidth: "32rem" },
  "&.cm-editor .cm-diagnostic": { padding: "4px 8px", borderRadius: "6px", color: "var(--txt-primary)" },
  "&.cm-editor .cm-diagnostic-error": { borderLeft: "3px solid var(--border-danger-strong)" },
});

// Marks a document replacement that came from the `value` prop rather than typing.
const fromProps = Annotation.define<boolean>();

const chrome = (placeholder: string, ariaLabel: string, hasError: boolean) => [
  placeholderExtension(placeholder),
  EditorView.contentAttributes.of({
    "aria-label": ariaLabel,
    "aria-invalid": String(hasError),
    spellcheck: "false",
    autocorrect: "off",
  }),
];

/** The CodeMirror view behind the query bar; loaded lazily, so it owns every CodeMirror import. */
export default function QueryEditor(props: Props) {
  const { value, onChange, placeholder, ariaLabel, hasError, className, vocabulary, focusOnMount, ...callbacks } =
    props;
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const configured = useRef<Vocabulary | null>(null);
  const [language] = useState(() => new Compartment());
  const [attributes] = useState(() => new Compartment());
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
    configured.current = vocabulary;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          theme,
          syntaxHighlighting(highlightStyle),
          attributes.of(chrome(placeholder, ariaLabel, hasError)),
          language.of(extensionsFor(vocabulary)),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            if (update.transactions.some((tr) => tr.annotation(fromProps))) return;
            latest.current.onChange(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;
    // The box padding is outside CodeMirror; a click there still focuses and places the caret.
    const box = host.current;
    const onMouseDown = (event: MouseEvent) => {
      if (event.target !== box || event.button !== 0) return;
      event.preventDefault();
      const line = editor.contentDOM.getBoundingClientRect();
      const anchor = editor.posAtCoords({ x: event.clientX, y: line.top + line.height / 2 }, false);
      editor.focus();
      editor.dispatch({ selection: { anchor }, scrollIntoView: true });
    };
    box.addEventListener("mousedown", onMouseDown);
    if (focusOnMount?.current) {
      focusOnMount.current = false;
      editor.focus();
      editor.dispatch({ selection: { anchor: editor.state.doc.length } });
    }
    return () => {
      box.removeEventListener("mousedown", onMouseDown);
      editor.destroy();
      view.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!view.current || configured.current === vocabulary) return;
    configured.current = vocabulary;
    view.current.dispatch({ effects: language.reconfigure(extensionsFor(vocabulary)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocabulary]);

  useEffect(() => {
    view.current?.dispatch({ effects: attributes.reconfigure(chrome(placeholder, ariaLabel, hasError)) });
  }, [attributes, placeholder, ariaLabel, hasError]);

  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const current = editor.state.doc.toString();
    if (current === value) return;
    editor.dispatch({
      changes: { from: 0, to: current.length, insert: value },
      annotations: fromProps.of(true),
    });
  }, [value]);

  return <div ref={host} className={editorBoxClass(hasError, className)} />;
}
