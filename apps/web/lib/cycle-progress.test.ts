// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { getCycleCompletion } from "./cycle-progress";

describe("getCycleCompletion", () => {
  it("leaves cancelled work items out of both counts", () => {
    expect(getCycleCompletion({ total_issues: 29, cancelled_issues: 8, completed_issues: 2 })).toEqual({
      completed: 2,
      total: 21,
      percentage: (2 / 21) * 100,
    });
  });

  it("returns 0 percent without work items", () => {
    expect(getCycleCompletion(null)).toEqual({ completed: 0, total: 0, percentage: 0 });
  });
});
