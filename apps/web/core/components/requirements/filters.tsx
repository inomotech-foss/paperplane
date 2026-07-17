/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useSearchParams } from "react-router";
import { ListFilter } from "lucide-react";

const STATUS = ["DRAFT", "IN_REVIEW", "APPROVED", "OBSOLETE"];
const PRIORITY = ["MUST", "SHOULD", "MAY"];

const readList = (params: URLSearchParams, key: string) => (params.get(key) ?? "").split(",").filter(Boolean);

export const RequirementsFilters = () => {
  const [open, setOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const statusSel = readList(searchParams, "status");
  const prioSel = readList(searchParams, "priority");
  const activeCount = statusSel.length + prioSel.length;

  const toggle = (key: string, value: string, current: string[]) => {
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next.length) params.set(key, next.join(","));
        else params.delete(key);
        return params;
      },
      { replace: true }
    );
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-subtle-1 px-2.5 py-1.5 text-sm text-secondary hover:bg-surface-2"
      >
        <ListFilter className="h-3.5 w-3.5" />
        Filters
        {activeCount > 0 && <span className="rounded bg-accent-primary/15 px-1 text-xs text-accent-primary">{activeCount}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-subtle-1 bg-surface-1 p-3 shadow-md">
            <FilterGroup title="Status" options={STATUS} selected={statusSel} onToggle={(v) => toggle("status", v, statusSel)} />
            <FilterGroup title="Priority" options={PRIORITY} selected={prioSel} onToggle={(v) => toggle("priority", v, prioSel)} />
          </div>
        </>
      )}
    </div>
  );
};

const FilterGroup = ({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) => (
  <div className="mb-3 last:mb-0">
    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-tertiary">{title}</div>
    {options.map((o) => (
      <label key={o} className="flex cursor-pointer items-center gap-2 py-0.5 text-sm text-secondary">
        <input type="checkbox" checked={selected.includes(o)} onChange={() => onToggle(o)} />
        {o}
      </label>
    ))}
  </div>
);
