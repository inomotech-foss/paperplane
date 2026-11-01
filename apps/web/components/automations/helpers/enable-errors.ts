/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { isRecord } from "@plane/types";
import { getFirstStringField } from "@/helpers/narrow.helper";

export type TAutomationEnableErrors = {
  /** A problem that belongs to no single card, such as a missing trigger or project. */
  message: string | undefined;
  trigger: string | undefined;
  /** Reasons keyed by action id. */
  actions: Record<string, string>;
};

/** Reads the field errors the API returns when it refuses to enable an automation. */
export function parseEnableErrors(body: unknown): TAutomationEnableErrors {
  const actions: Record<string, string> = {};
  const rawActions = isRecord(body) ? body.actions : undefined;
  if (isRecord(rawActions)) {
    for (const [actionId, errors] of Object.entries(rawActions)) {
      const message = getFirstStringField(errors, "config");
      if (message) actions[actionId] = message;
    }
  }
  return {
    message: getFirstStringField(body, "is_enabled") ?? getFirstStringField(body, "project_ids"),
    trigger: getFirstStringField(body, "trigger_config"),
    actions,
  };
}

/** The text for the enable failure toast. */
export const describeEnableErrors = (errors: TAutomationEnableErrors): string | undefined =>
  errors.message ?? errors.trigger ?? Object.values(errors.actions)[0];
