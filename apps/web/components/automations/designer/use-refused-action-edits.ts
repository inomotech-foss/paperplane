/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import type { TAutomationActionConfig } from "@plane/types";

export type TRefusedActionEdit = { config: TAutomationActionConfig; message: string };

type TOptions = {
  save: (actionId: string, config: TAutomationActionConfig) => Promise<unknown>;
  /** Reads the stored state when a request settles, not when it started. */
  isEnabled: () => boolean;
  describeError: (error: unknown) => string;
};

/**
 * An enabled automation refuses an incomplete action edit. The refused config is kept here, keyed by action id,
 * so it stays on screen. Once the automation is disabled it is saved again, now as a draft.
 */
export const useRefusedActionEdits = (options: TOptions) => {
  const { save, isEnabled, describeError } = options;
  const [refusals, setRefusals] = useState<Record<string, TRefusedActionEdit>>({});
  // Mirrors the state, so a handler that settles later reads the current refusals.
  const refusalsRef = useRef<Record<string, TRefusedActionEdit>>({});
  const latestEdit = useRef<Record<string, number>>({});

  const update = (actionId: string, refusal: TRefusedActionEdit | undefined) => {
    const { [actionId]: _previous, ...rest } = refusalsRef.current;
    refusalsRef.current = refusal ? { ...rest, [actionId]: refusal } : rest;
    setRefusals(refusalsRef.current);
  };

  const saveConfig = async (actionId: string, config: TAutomationActionConfig, isRetry = false): Promise<boolean> => {
    const edit = (latestEdit.current[actionId] ?? 0) + 1;
    latestEdit.current[actionId] = edit;
    update(actionId, undefined);
    try {
      await save(actionId, config);
      return true;
    } catch (error) {
      if (latestEdit.current[actionId] !== edit) return false;
      // Disabled while the request was in flight, so the edit now saves as a draft.
      if (!isRetry && !isEnabled()) return saveConfig(actionId, config, true);
      update(actionId, { config, message: describeError(error) });
      return false;
    }
  };

  /** Saves every refused edit again. Call it once the automation is disabled. */
  const resubmitAll = () => {
    for (const [actionId, refusal] of Object.entries(refusalsRef.current)) void saveConfig(actionId, refusal.config);
  };

  return { refusals, saveConfig, resubmitAll };
};
