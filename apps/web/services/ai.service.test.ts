// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import { parseEditorTaskReply } from "./ai.service";

vi.mock("@/services/api-client", () => ({ apiClient: {} }));

describe("parseEditorTaskReply", () => {
  it("reads the response text and rejects anything else", () => {
    expect(parseEditorTaskReply({ response: "Better text", extra: 1 })).toEqual({ response: "Better text" });
    expect(() => parseEditorTaskReply({ error: "nope" })).toThrow();
  });
});
