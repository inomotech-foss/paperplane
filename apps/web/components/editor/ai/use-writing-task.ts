/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { TWritingTask } from "@/services/ai.service";
import { AIService } from "@/services/ai.service";
import { getWritingErrorKey, WRITING_MAX_TEXT_LENGTH } from "./writing-task";

const aiService = new AIService();

export type TWritingTaskState =
  | { status: "idle" }
  | { status: "loading"; task: TWritingTask }
  | { status: "done"; task: TWritingTask; html: string }
  | { status: "error"; task: TWritingTask; errorKey: string };

/** Runs writing tasks one at a time. A new run or unmount cancels the running one. */
export function useWritingTask(workspaceSlug: string) {
  const [state, setState] = useState<TWritingTaskState>({ status: "idle" });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const run = useCallback(
    async (task: TWritingTask) => {
      controllerRef.current?.abort();
      if (task.text.length > WRITING_MAX_TEXT_LENGTH) {
        setState({ status: "error", task, errorKey: "ai_writing.errors.too_long" });
        return;
      }
      const controller = new AbortController();
      controllerRef.current = controller;
      setState({ status: "loading", task });
      try {
        const html = await aiService.runWritingTask(workspaceSlug, task, controller.signal);
        if (!controller.signal.aborted) setState({ status: "done", task, html });
      } catch (error) {
        if (!controller.signal.aborted) setState({ status: "error", task, errorKey: getWritingErrorKey(error, task) });
      }
    },
    [workspaceSlug]
  );

  return { state, run };
}
