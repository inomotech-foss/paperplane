// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import { WorkItemQueryService } from "@/services/issue";
import { checkWorkItemQuery } from "./check";

describe("checkWorkItemQuery", () => {
  it("asks once per query and scope, and again on refresh", async () => {
    const validate = vi.spyOn(WorkItemQueryService.prototype, "validate").mockResolvedValue({ valid: true });
    await checkWorkItemQuery("ws", "a = 1", "p1");
    await checkWorkItemQuery("ws", "a = 1", "p1");
    await checkWorkItemQuery("ws", "a = 1", "p2");
    expect(validate).toHaveBeenCalledTimes(2);

    validate.mockResolvedValueOnce({ valid: false, error: "gone" });
    expect(await checkWorkItemQuery("ws", "a = 1", "p1", true)).toEqual({ valid: false, error: "gone" });
    // the refreshed answer is kept
    expect(await checkWorkItemQuery("ws", "a = 1", "p1")).toEqual({ valid: false, error: "gone" });
    expect(validate).toHaveBeenCalledTimes(3);
  });

  it("does not keep a failed request", async () => {
    const validate = vi.spyOn(WorkItemQueryService.prototype, "validate").mockRejectedValueOnce(new Error("offline"));
    await expect(checkWorkItemQuery("ws", "b = 1", "p1")).rejects.toThrow("offline");
    validate.mockResolvedValueOnce({ valid: true });
    expect(await checkWorkItemQuery("ws", "b = 1", "p1")).toEqual({ valid: true });
  });
});
