/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { isRecord } from "@plane/types";
import { getFirstStringField } from "@/helpers/narrow.helper";

export type TAutomationEnableErrors = {
  /** Problems that belong to no single card, such as a missing trigger or project. */
  messages: string[];
  trigger: string | undefined;
  /** Reasons keyed by action id. */
  actions: Record<string, string>;
};

const CARD_KEYS = new Set(["trigger_config", "actions"]);

/** Reads the field errors the API returns when it refuses to enable an automation. */
export function parseEnableErrors(body: unknown): TAutomationEnableErrors {
  const actions: Record<string, string> = {};
  const messages: string[] = [];
  if (isRecord(body)) {
    if (isRecord(body.actions)) {
      for (const [actionId, errors] of Object.entries(body.actions)) {
        const message = getFirstStringField(errors, "config");
        if (message) actions[actionId] = message;
      }
    }
    // `is_enabled`, `project_ids`, `condition`, or an `error` / `detail` body from elsewhere.
    for (const key of Object.keys(body)) {
      if (CARD_KEYS.has(key)) continue;
      const message = getFirstStringField(body, key);
      if (message) messages.push(message);
    }
  }
  return { messages, trigger: getFirstStringField(body, "trigger_config"), actions };
}

/** The text for the enable failure toast. */
export const describeEnableErrors = (errors: TAutomationEnableErrors): string | undefined =>
  errors.messages.length > 0
    ? errors.messages.join(" ")
    : (errors.trigger ?? Object.values(errors.actions).find((message) => message.length > 0));
