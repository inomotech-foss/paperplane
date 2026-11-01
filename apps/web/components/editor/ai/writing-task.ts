/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema } from "@plane/api-types";
import { isApiError } from "@plane/services";
import { readField } from "@plane/types";
import type { TWritingTask } from "@/services/ai.service";

/** Mirrors the server limit, so an oversized selection fails without a request. */
export const WRITING_MAX_TEXT_LENGTH = 20000;

export const WRITING_ACTIONS = [
  "rephrase",
  "simplify",
  "elaborate",
  "summarize",
  "fix_grammar",
] as const satisfies readonly ApiSchema<"WritingActionEnum">[];

export const WRITING_TONES = [
  "professional",
  "casual",
  "friendly",
  "confident",
] as const satisfies readonly ApiSchema<"WritingToneEnum">[];

export type TWritingChoice =
  | { action: (typeof WRITING_ACTIONS)[number] }
  | { action: "adjust_tone"; tone: ApiSchema<"WritingToneEnum"> }
  | { action: "custom"; instruction: string };

export const toWritingTask = (text: string, choice: TWritingChoice): TWritingTask => ({ ...choice, text });

/** The i18n key of the message for a failed writing task. */
export const getWritingErrorKey = (error: unknown, task: TWritingTask): string => {
  if (!isApiError(error)) return "ai_writing.errors.generic";
  if (error.status === 429 || error.code === "provider_rate_limit") return "ai_writing.errors.rate_limited";
  if (error.status === 503 || error.code === "llm_not_configured") return "ai_writing.errors.not_configured";
  if (error.status === 400 && readField(error.data, "text") !== undefined)
    return task.text.trim() ? "ai_writing.errors.too_long" : "ai_writing.errors.empty_text";
  switch (error.code) {
    case "provider_auth":
      return "ai_writing.errors.provider_auth";
    case "provider_model":
      return "ai_writing.errors.provider_model";
    case "empty_response":
      return "ai_writing.errors.empty_response";
    default:
      return "ai_writing.errors.generic";
  }
};
