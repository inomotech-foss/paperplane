/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import type { TAutomationActionConfig } from "@plane/types";

type TOptions = {
  /** Id of the stored action, undefined until the server has accepted a config. */
  savedId: string | undefined;
  savedConfig: TAutomationActionConfig | undefined;
  initialConfig: TAutomationActionConfig;
  /** Resolves to the id of the created action. */
  create: (config: TAutomationActionConfig) => Promise<string>;
  update: (id: string, config: TAutomationActionConfig) => Promise<void>;
  describeError: (error: unknown) => string;
};

/**
 * Keeps the config the user is editing until the server accepts it. A new action is only
 * created once its config is valid, so a stored action is always complete. A rejected edit
 * stays on screen with the server's reason instead of reverting.
 */
export const useActionDraft = (options: TOptions) => {
  const { savedId, savedConfig, initialConfig, create, update, describeError } = options;
  const [draft, setDraft] = useState<TAutomationActionConfig | null>(savedId ? null : initialConfig);
  const [error, setError] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState(0);
  const latestRequest = useRef(0);
  const pendingCreate = useRef<Promise<string> | null>(null);
  const createdId = useRef<string | null>(null);

  const save = async (config: TAutomationActionConfig): Promise<void> => {
    const id = savedId ?? createdId.current;
    if (id) return update(id, config);
    // An edit made while the action is being created updates it instead of creating another
    const pending = pendingCreate.current;
    if (pending) {
      await pending.catch(() => undefined);
      return save(config);
    }
    const creating = create(config);
    pendingCreate.current = creating;
    try {
      createdId.current = await creating;
    } finally {
      pendingCreate.current = null;
    }
  };

  /** Resolves to the stored action id once any create in flight has settled. */
  const settle = async (): Promise<string | undefined> => {
    if (pendingCreate.current) await pendingCreate.current.catch(() => undefined);
    return savedId ?? createdId.current ?? undefined;
  };

  const change = async (config: TAutomationActionConfig): Promise<boolean> => {
    const request = latestRequest.current + 1;
    latestRequest.current = request;
    const isLatest = () => latestRequest.current === request;
    setDraft(config);
    setInFlight((count) => count + 1);
    try {
      await save(config);
      if (isLatest()) {
        setDraft(null);
        setError(null);
      }
      return true;
    } catch (cause) {
      if (isLatest()) setError(describeError(cause));
      return false;
    } finally {
      setInFlight((count) => count - 1);
    }
  };

  return { config: draft ?? savedConfig ?? initialConfig, error, isSaving: inFlight > 0, change, settle };
};
