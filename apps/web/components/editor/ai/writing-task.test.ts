// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { ApiError } from "@plane/services";
import { getWritingErrorKey, toWritingTask } from "./writing-task";

const apiError = (status: number, data?: unknown) => new ApiError(new Response(null, { status }), data);

describe("toWritingTask", () => {
  it("sends the selection as the text with the chosen action", () => {
    expect(toWritingTask("Some text", { action: "summarize" })).toEqual({ action: "summarize", text: "Some text" });
    expect(toWritingTask("Hi", { action: "adjust_tone", tone: "casual" })).toEqual({
      action: "adjust_tone",
      tone: "casual",
      text: "Hi",
    });
    expect(toWritingTask("Hi", { action: "custom", instruction: "Shorter" })).toEqual({
      action: "custom",
      instruction: "Shorter",
      text: "Hi",
    });
  });
});

const task = toWritingTask("Some text", { action: "rephrase" });

describe("getWritingErrorKey", () => {
  it("maps API errors to messages", () => {
    expect(getWritingErrorKey(apiError(503, { error: "x", code: "llm_not_configured" }), task)).toBe(
      "ai_writing.errors.not_configured"
    );
    expect(getWritingErrorKey(apiError(429, { detail: "Throttled" }), task)).toBe("ai_writing.errors.rate_limited");
    expect(getWritingErrorKey(apiError(502, { error: "x", code: "provider_rate_limit" }), task)).toBe(
      "ai_writing.errors.rate_limited"
    );
    expect(getWritingErrorKey(apiError(502, { error: "x", code: "provider_auth" }), task)).toBe(
      "ai_writing.errors.provider_auth"
    );
    expect(getWritingErrorKey(apiError(502, { error: "x", code: "provider_model" }), task)).toBe(
      "ai_writing.errors.provider_model"
    );
    expect(getWritingErrorKey(apiError(502, { error: "x", code: "empty_response" }), task)).toBe(
      "ai_writing.errors.empty_response"
    );
    expect(getWritingErrorKey(apiError(400, { text: ["Too long"] }), task)).toBe("ai_writing.errors.too_long");
    expect(getWritingErrorKey(apiError(400, { tone: ["Required"] }), task)).toBe("ai_writing.errors.generic");
    expect(getWritingErrorKey(apiError(502, { error: "x", code: "provider_error" }), task)).toBe(
      "ai_writing.errors.generic"
    );
  });

  it("tells a blank text from a long one", () => {
    expect(getWritingErrorKey(apiError(400, { text: ["Blank"] }), toWritingTask("  ", { action: "rephrase" }))).toBe(
      "ai_writing.errors.empty_text"
    );
  });

  it("falls back to the generic message for anything else", () => {
    expect(getWritingErrorKey(new Error("offline"), task)).toBe("ai_writing.errors.generic");
  });
});
