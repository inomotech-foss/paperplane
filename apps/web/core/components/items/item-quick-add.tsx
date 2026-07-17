/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { PlusIcon } from "lucide-react";
// plane imports
import { Row } from "@plane/ui";
import { cn } from "@plane/utils";
// local
import type { TItemGroupNode, TItemQuickAdd } from "./types";

type Props<T> = {
  group: TItemGroupNode<T>;
  quickAdd: TItemQuickAdd<T>;
  indent: number;
};

// Inline "add item" row: a button that expands into a single title input,
// submitted on Enter, matching the work-items quick-add form.
export const ItemQuickAdd = <T,>({ group, quickAdd, indent }: Props<T>) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const prefix = quickAdd.prefix?.(group);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = value.trim();
    if (!title || submitting) return;
    setSubmitting(true);
    try {
      await quickAdd.onSubmit(title, group);
      setValue("");
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <Row
        className="flex w-full cursor-pointer items-center gap-2 bg-layer-transparent py-3 text-tertiary hover:bg-layer-transparent-hover hover:text-primary"
        onClick={() => setOpen(true)}
      >
        <span style={{ width: indent }} className="flex-shrink-0" />
        <PlusIcon className="h-3.5 w-3.5 stroke-2" />
        <span className="text-13 font-medium">{quickAdd.buttonLabel ?? "New item"}</span>
      </Row>
    );
  }

  return (
    <div className="shadow-raised-200">
      <form
        onSubmit={submit}
        className="flex w-full items-center gap-x-3 border-[0.5px] border-t-0 border-subtle bg-surface-1 px-3"
      >
        <span style={{ width: indent }} className="flex-shrink-0" />
        {prefix && <span className="text-11 font-medium text-placeholder">{prefix}</span>}
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          autoFocus
          placeholder={quickAdd.placeholder ?? "Title"}
          value={value}
          disabled={submitting}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => !value.trim() && setOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          className={cn(
            "w-full rounded-md bg-transparent px-2 py-3 text-13 font-medium leading-5 text-secondary outline-none",
            submitting && "opacity-60"
          )}
        />
      </form>
      <div className="px-3 py-2 text-11 italic text-secondary">Press Enter to add</div>
    </div>
  );
};
