/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { CircleHelp, Play, X } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import type { SemanticError } from "@plane/pql";
import type { TWorkItemQueryValidation } from "@plane/types";
import { cn } from "@plane/utils";
// services
import { WorkItemQueryService } from "@/services/issue";
// local imports
import { editorBoxClass } from "./editor-classes";
import { WorkItemQueryHelp } from "./query-help";
import { useValuesFor } from "./values";
import { toVocabulary } from "./vocabulary";

const workItemQueryService = new WorkItemQueryService();

const QueryEditor = lazy(() => import("./editor"));

type TQueryDraft = { query: string; error: string };

/** `edits` is what the person typed since the last apply, null when the editor shows the applied query. */
const useDraftState = (draft: TQueryDraft | undefined) => {
  const [edits, setEdits] = useState<string | null>(draft ? draft.query : null);
  const [runError, setRunError] = useState<string | null>(draft ? draft.error : null);
  return { edits, setEdits, runError, setRunError };
};

type Props = {
  workspaceSlug: string;
  /** Scopes name resolution (states, types, properties) to one project. */
  projectId?: string;
  /** The query currently applied to the list, empty for none. */
  value: string;
  /** A query shown unapplied with its error, e.g. an invalid one from a link. Read on mount. */
  draft?: TQueryDraft;
  onApply: (pql: string) => Promise<void> | void;
  className?: string;
  /** Shown at the end of the line, e.g. "Save view" for the whole view. */
  actions?: React.ReactNode;
};

/**
 * A single line where a person types a Plane Query Language expression
 * (`type = "Invoice" AND state = "Paid" AND descendantOf("CUST-1")`) to filter
 * the list, with highlighting, completion and inline errors. The query is
 * validated before it is applied, so a typo shows up under the editor instead
 * of as a failed fetch.
 */
export const WorkItemQueryBar = observer(function WorkItemQueryBar(props: Props) {
  const { workspaceSlug, projectId, value, draft: initialDraft, onApply, className, actions } = props;
  // i18n
  const { t } = useTranslation();
  // states: an applied query never goes stale, as `edits` is null while it is shown
  const { edits, setEdits, runError, setRunError } = useDraftState(initialDraft);
  const [isRunning, setIsRunning] = useState(false);
  const [inlineErrors, setInlineErrors] = useState<string[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  // Set when the fallback is focused, so the editor takes focus as soon as it mounts.
  const focusOnMount = useRef(false);
  // derived values
  const draft = edits ?? value;
  const isDirty = draft.trim() !== value.trim();
  const isApplied = value.trim().length > 0;
  const hasError = inlineErrors.length > 0 || !!runError;

  const { data: fields } = useSWR(
    `WORK_ITEM_QUERY_FIELDS_${workspaceSlug}`,
    () => workItemQueryService.fields(workspaceSlug),
    { revalidateOnFocus: false }
  );
  const valuesFor = useValuesFor(projectId);
  const vocabulary = useMemo(() => toVocabulary(fields, valuesFor), [fields, valuesFor]);

  const validate = useCallback(
    async (pql: string): Promise<SemanticError | null> => {
      try {
        const result = await workItemQueryService.validate(workspaceSlug, pql, projectId);
        if (result.valid) return null;
        return {
          position: result.position,
          token: result.token,
          message: result.error ?? t("work_item_query.invalid"),
        };
      } catch {
        // The run button reports a failed request; a stale underline would be wrong.
        return null;
      }
    },
    [workspaceSlug, projectId, t]
  );

  const onDiagnostics = useCallback((diagnostics: { message: string }[]) => {
    setInlineErrors(diagnostics.map((diagnostic) => diagnostic.message));
  }, []);

  const run = async () => {
    const pql = draft.trim();
    if (!isDirty) return;
    setIsRunning(true);
    try {
      if (pql) {
        const result: TWorkItemQueryValidation = await workItemQueryService.validate(workspaceSlug, pql, projectId);
        if (!result.valid) {
          setRunError(result.error ?? t("work_item_query.invalid"));
          return;
        }
      }
      setRunError(null);
      await onApply(pql);
      setEdits(null);
    } catch (error) {
      setRunError((error as { error?: string })?.error ?? t("work_item_query.invalid"));
    } finally {
      setIsRunning(false);
    }
  };

  const clear = async () => {
    setEdits(null);
    setRunError(null);
    if (isApplied) await onApply("");
  };

  const revert = () => {
    setEdits(null);
    setRunError(null);
  };

  return (
    <div className={cn("flex flex-col gap-1 border-b border-subtle-1 bg-surface-1 px-4 py-2", className)}>
      <div className="flex items-center gap-2">
        <span
          className={cn("shrink-0 rounded-sm px-1.5 py-0.5 font-code text-10 font-semibold tracking-wide", {
            "bg-accent-primary/10 text-accent-primary": isApplied,
            "bg-layer-2 text-tertiary": !isApplied,
          })}
          title={isApplied ? t("work_item_query.applied") : undefined}
        >
          PQL
        </span>
        <div className="group/query relative flex min-w-0 flex-1">
          <Suspense
            fallback={
              // Focusable so a click before CodeMirror loads is handed on to it.
              <div
                role="textbox"
                tabIndex={0}
                aria-label={t("work_item_query.placeholder")}
                aria-readonly
                onFocus={() => (focusOnMount.current = true)}
                className={editorBoxClass(hasError, cn({ "text-placeholder": !draft }))}
              >
                <span className="truncate">{draft || t("work_item_query.placeholder")}</span>
              </div>
            }
          >
            <QueryEditor
              value={draft}
              onChange={(next) => {
                setEdits(next);
                setRunError(null);
              }}
              onSubmit={() => void run()}
              onCancel={revert}
              vocabulary={vocabulary}
              validate={validate}
              onDiagnostics={onDiagnostics}
              placeholder={t("work_item_query.placeholder")}
              ariaLabel={t("work_item_query.placeholder")}
              hasError={hasError}
              focusOnMount={focusOnMount}
            />
          </Suspense>
          {/* Typing errors float below the box, so typing never shifts the page; an open completion list hides them. */}
          {inlineErrors.length > 0 && !runError && (
            <div
              role="alert"
              className={cn(
                "absolute top-full left-0 z-30 mt-1 hidden w-max max-w-full flex-col gap-0.5 rounded-md border border-subtle bg-layer-1 px-2 py-1 text-11 text-danger-primary shadow-overlay-100",
                "group-focus-within/query:flex group-has-[.cm-tooltip-autocomplete]/query:hidden!"
              )}
            >
              {inlineErrors.map((message) => (
                <span key={message}>{message}</span>
              ))}
            </div>
          )}
        </div>
        <Button
          variant={isDirty ? "primary" : "secondary"}
          size="sm"
          onClick={() => void run()}
          disabled={!isDirty || isRunning}
          loading={isRunning}
          icon={<Play className="size-3" />}
          stretch="auto"
          label={t("work_item_query.run")}
        />
        {(isApplied || draft) && (
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => void clear()}
            icon={<X className="size-3" />}
            stretch="auto"
            label={t("work_item_query.clear")}
          />
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
        {actions && <div className="flex shrink-0 items-center gap-2 border-l border-subtle pl-2">{actions}</div>}
      </div>
      {runError && (
        <p role="alert" className="text-11 text-danger-primary">
          {runError}
        </p>
      )}
      {isHelpOpen && <WorkItemQueryHelp fields={fields} onClose={() => setIsHelpOpen(false)} />}
    </div>
  );
});
