// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useState } from "react";

type Props = {
  value: string;
  onCommit: (value: string) => void;
  disabled?: boolean;
  rows: number;
  placeholder: string;
};

/**
 * Saves on blur instead of on every keystroke. The server sanitizes the template,
 * so writing each keystroke back would rewrite text that is still being typed.
 */
export function TemplateTextarea(props: Props) {
  const { value, onCommit, disabled, rows, placeholder } = props;
  const [draft, setDraft] = useState<string | null>(null);
  const [savedValue, setSavedValue] = useState(value);

  if (value !== savedValue) {
    setSavedValue(value);
    setDraft(null);
  }

  return (
    <textarea
      value={draft ?? value}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== null && draft !== value) onCommit(draft);
      }}
      disabled={disabled}
      rows={rows}
      placeholder={placeholder}
      className="placeholder-tertiary w-full rounded-md border-[0.5px] border-subtle-1 bg-layer-2 px-3 py-2 text-13 focus:outline-none"
    />
  );
}
