// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useEffect, useEffectEvent, useRef, useState } from "react";

type Props = {
  value: string;
  /** Resolves to whether the save succeeded. */
  onCommit: (value: string) => Promise<boolean>;
  disabled?: boolean;
  rows: number;
  placeholder: string;
};

/**
 * Saves on blur instead of on every keystroke. The server sanitizes the template,
 * so writing each keystroke back would rewrite text that is still being typed.
 * A draft that was never blurred is saved when the field unmounts or the page is hidden.
 */
export function TemplateTextarea(props: Props) {
  const { value, onCommit, disabled, rows, placeholder } = props;
  const [draft, setDraft] = useState<string | null>(null);
  const saving = useRef<string | null>(null);

  const commit = async (next: string) => {
    saving.current = next;
    const saved = await onCommit(next);
    if (saving.current === next) saving.current = null;
    // On failure the draft stays, so the text is not lost and the next blur retries.
    if (saved) setDraft((current) => (current === next ? null : current));
  };

  const flush = useEffectEvent(() => {
    if (draft !== null && draft !== value && draft !== saving.current) void commit(draft);
  });

  useEffect(() => {
    const onPageHide = () => flush();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      flush();
    };
  }, []);

  return (
    <textarea
      value={draft ?? value}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft === null) return;
        // While a save is in flight the store already shows it optimistically, so the
        // draft is kept until the save resolves. A failed save then does not lose it.
        if (draft !== value) void commit(draft);
        else if (saving.current === null) setDraft(null);
      }}
      disabled={disabled}
      rows={rows}
      placeholder={placeholder}
      className="placeholder-tertiary w-full rounded-md border-[0.5px] border-subtle-1 bg-layer-2 px-3 py-2 text-13 focus:outline-none"
    />
  );
}
