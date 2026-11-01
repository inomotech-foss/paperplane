/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { AiStar1Outline, SendOutline, WarningCircleOutline } from "@makeplane/propel/icons";
import type { TAIMenuProps } from "@plane/editor";
import { useTranslation } from "@plane/i18n";
// components
import { RichTextEditor } from "@/components/editor/rich-text";
// local imports
import { useWritingTask } from "./use-writing-task";
import type { TWritingChoice } from "./writing-task";
import { toWritingTask, WRITING_ACTIONS, WRITING_TONES } from "./writing-task";

type Props = TAIMenuProps & {
  workspaceId: string;
  workspaceSlug: string;
  projectId?: string;
};

const itemClassName =
  "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-13 text-secondary transition-colors hover:bg-layer-1 disabled:cursor-not-allowed disabled:opacity-60";

export function WritingAssistantMenu(props: Props) {
  const { selection, canReplace, onReplace, onInsertBelow, onClose, workspaceId, workspaceSlug, projectId } = props;
  const { t } = useTranslation();
  const previewId = useId();
  const [instruction, setInstruction] = useState("");
  const { state, run } = useWritingTask(workspaceSlug);
  const canRun = selection.trim().length > 0;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const choose = (choice: TWritingChoice) => {
    if (canRun) void run(toWritingTask(selection, choice));
  };

  const submitInstruction = () => {
    const value = instruction.trim();
    if (value) choose({ action: "custom", instruction: value });
  };

  return (
    <div className="flex w-[22rem] max-w-[90vw] flex-col overflow-hidden rounded-md border-[0.5px] border-strong bg-surface-1 shadow-raised-200">
      {state.status === "idle" && (
        <>
          <form
            className="flex items-center gap-2 border-b border-subtle px-3 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitInstruction();
            }}
          >
            <AiStar1Outline className="size-3.5 shrink-0 text-accent-primary" />
            <input
              type="text"
              className="w-full border-none bg-transparent text-13 outline-none placeholder:text-placeholder"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={t("ai_writing.instruction_placeholder")}
              aria-label={t("ai_writing.instruction_placeholder")}
              ref={inputRef}
              disabled={!canRun}
            />
            <IconButton
              type="submit"
              variant="ghost"
              size="sm"
              icon={<Icon icon={SendOutline} />}
              aria-label={t("ai_writing.send")}
              disabled={!canRun || !instruction.trim()}
            />
          </form>
          <div className="flex flex-col px-1.5 py-1.5">
            {WRITING_ACTIONS.map((action) => (
              <button
                key={action}
                type="button"
                className={itemClassName}
                disabled={!canRun}
                onClick={() => choose({ action })}
              >
                {t(`ai_writing.actions.${action}`)}
              </button>
            ))}
          </div>
          <div className="border-t border-subtle px-3.5 py-2">
            <p className="text-11 font-medium text-tertiary">{t("ai_writing.tone.label")}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {WRITING_TONES.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  className="rounded-sm bg-layer-1 px-1.5 py-1 text-11 font-medium text-secondary transition-colors hover:bg-layer-1-hover disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canRun}
                  onClick={() => choose({ action: "adjust_tone", tone })}
                >
                  {t(`ai_writing.tone.${tone}`)}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      {state.status === "loading" && (
        <div className="flex items-center justify-between gap-3 px-3.5 py-3">
          <p className="flex items-center gap-2 text-13 text-secondary">
            <AiStar1Outline className="size-3.5 shrink-0 animate-pulse text-accent-primary" />
            {t("ai_writing.generating")}
          </p>
          <Button
            variant="secondary"
            size="sm"
            stretch="auto"
            label={t("ai_writing.result.discard")}
            onClick={onClose}
          />
        </div>
      )}
      {state.status === "done" && (
        <div className="flex flex-col gap-3 px-3.5 py-3">
          <div className="vertical-scrollbar scrollbar-sm max-h-60 overflow-y-auto">
            <RichTextEditor
              key={state.html}
              editable={false}
              id={previewId}
              initialValue={state.html}
              displayConfig={{ fontSize: "small-font" }}
              containerClassName="!p-0 border-none"
              editorClassName="!pl-0"
              workspaceId={workspaceId}
              workspaceSlug={workspaceSlug}
              projectId={projectId}
            />
          </div>
          {!canReplace && <p className="text-11 text-tertiary">{t("ai_writing.result.replace_unavailable")}</p>}
          <div className="flex flex-wrap items-center gap-2">
            {canReplace && (
              <Button
                variant="primary"
                size="sm"
                stretch="auto"
                label={t("ai_writing.result.replace")}
                onClick={() => onReplace(state.html)}
              />
            )}
            <Button
              variant={canReplace ? "secondary" : "primary"}
              size="sm"
              stretch="auto"
              label={t("ai_writing.result.insert_below")}
              onClick={() => onInsertBelow(state.html)}
            />
            <Button
              variant="ghost"
              size="sm"
              stretch="auto"
              label={t("ai_writing.result.try_again")}
              onClick={() => void run(state.task)}
            />
            <Button variant="ghost" size="sm" stretch="auto" label={t("ai_writing.result.discard")} onClick={onClose} />
          </div>
        </div>
      )}
      {state.status === "error" && (
        <div className="flex flex-col gap-3 px-3.5 py-3">
          <p role="alert" className="flex items-start gap-2 text-13 text-danger-primary">
            <WarningCircleOutline className="mt-0.5 size-3.5 shrink-0" />
            {t(state.errorKey)}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              stretch="auto"
              label={t("ai_writing.result.try_again")}
              onClick={() => void run(state.task)}
            />
            <Button variant="ghost" size="sm" stretch="auto" label={t("ai_writing.result.discard")} onClick={onClose} />
          </div>
        </div>
      )}
      <p className="border-t border-subtle bg-surface-2 px-3.5 py-1.5 text-11 text-tertiary">
        {t("ai_writing.consent")}
      </p>
    </div>
  );
}
