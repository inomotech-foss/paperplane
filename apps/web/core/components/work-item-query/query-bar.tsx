/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { CircleHelp, Play, X } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import type { TWorkItemQueryValidation } from "@plane/types";
import { cn } from "@plane/utils";
// services
import { WorkItemQueryService } from "@/services/issue";
// local imports
import { WorkItemQueryHelp } from "./query-help";

const workItemQueryService = new WorkItemQueryService();

type Props = {
  workspaceSlug: string;
  /** Scopes name resolution (states, types, properties) to one project. */
  projectId?: string;
  /** The query currently applied to the list, empty for none. */
  value: string;
  onApply: (pql: string) => Promise<void> | void;
  className?: string;
};

/**
 * A single line where a person types a Plane Query Language expression
 * (`type = "Invoice" AND state = "Paid" AND descendantOf("CUST-1")`) to filter
 * the list. The query is validated before it is applied, so a typo shows up
 * under the input, at the character that broke, instead of as a failed fetch.
 */
export const WorkItemQueryBar = observer(function WorkItemQueryBar(props: Props) {
  const { workspaceSlug, projectId, value, onApply, className } = props;
  // i18n
  const { t } = useTranslation();
  // states
  const [draft, setDraft] = useState(value);
  const [isRunning, setIsRunning] = useState(false);
  const [validation, setValidation] = useState<TWorkItemQueryValidation | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  // derived values
  const isDirty = draft.trim() !== value.trim();
  const isApplied = value.trim().length > 0;

  useEffect(() => {
    setDraft(value);
    setValidation(null);
  }, [value]);

  const { data: fields } = useSWR(
    isHelpOpen ? `WORK_ITEM_QUERY_FIELDS_${workspaceSlug}` : null,
    () => workItemQueryService.fields(workspaceSlug),
    { revalidateOnFocus: false }
  );

  const run = async () => {
    const pql = draft.trim();
    if (pql === value.trim()) return;
    setIsRunning(true);
    try {
      if (pql) {
        const result = await workItemQueryService.validate(workspaceSlug, pql, projectId);
        if (!result.valid) {
          setValidation(result);
          return;
        }
      }
      setValidation(null);
      await onApply(pql);
    } catch (error) {
      setValidation({ valid: false, error: (error as { error?: string })?.error ?? t("work_item_query.invalid") });
    } finally {
      setIsRunning(false);
    }
  };

  const clear = async () => {
    setDraft("");
    setValidation(null);
    if (isApplied) await onApply("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void run();
    }
    if (event.key === "Escape") {
      setDraft(value);
      setValidation(null);
    }
  };

  const errorMarker = useMemo(() => {
    if (!validation || validation.valid || validation.position === undefined) return null;
    return `${" ".repeat(Math.max(0, Math.min(validation.position, draft.length)))}^`;
  }, [validation, draft.length]);

  return (
    <div className={cn("flex flex-col gap-1 border-b border-subtle-1 bg-surface-1 px-4 py-2", className)}>
      <div className="flex items-center gap-2">
        <span
          className={cn("font-mono shrink-0 rounded-sm px-1.5 py-0.5 text-10 font-semibold tracking-wide", {
            "bg-accent-primary/10 text-accent-primary": isApplied,
            "bg-layer-2 text-tertiary": !isApplied,
          })}
          title={isApplied ? t("work_item_query.applied") : undefined}
        >
          PQL
        </span>
        <input
          type="text"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            if (validation) setValidation(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={t("work_item_query.placeholder")}
          spellCheck={false}
          autoComplete="off"
          aria-label={t("work_item_query.placeholder")}
          aria-invalid={validation ? !validation.valid : undefined}
          className={cn(
            "font-mono h-7 w-full min-w-0 flex-1 rounded-sm border bg-layer-1 px-2 text-12 text-primary outline-none placeholder:text-placeholder focus:border-accent-strong",
            validation && !validation.valid ? "border-danger-strong" : "border-subtle-1"
          )}
        />
        <Button
          variant={isDirty ? "primary" : "secondary"}
          size="sm"
          onClick={() => void run()}
          disabled={!isDirty || isRunning}
          loading={isRunning}
          prependIcon={<Play className="size-3" />}
        >
          {t("work_item_query.run")}
        </Button>
        {(isApplied || draft) && (
          <Button variant="tertiary" size="sm" onClick={() => void clear()} prependIcon={<X className="size-3" />}>
            {t("work_item_query.clear")}
          </Button>
        )}
        <button
          type="button"
          onClick={() => setIsHelpOpen((open) => !open)}
          className={cn("grid size-7 shrink-0 place-items-center rounded-sm text-tertiary hover:bg-layer-2", {
            "bg-layer-2 text-primary": isHelpOpen,
          })}
          aria-label={t("work_item_query.help")}
          title={t("work_item_query.help")}
        >
          <CircleHelp className="size-3.5" />
        </button>
      </div>
      {validation && !validation.valid && (
        <div className="font-mono flex flex-col gap-0.5 pl-11 text-11 text-danger-primary">
          {errorMarker && <pre className="m-0 leading-none whitespace-pre">{errorMarker}</pre>}
          <span className="font-sans">{validation.error}</span>
        </div>
      )}
      {isHelpOpen && <WorkItemQueryHelp fields={fields} onClose={() => setIsHelpOpen(false)} />}
    </div>
  );
});
