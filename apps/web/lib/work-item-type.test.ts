// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { pickIssueTypeId } from "./work-item-type";

const types = [{ id: "task" }, { id: "bug" }];

describe("pickIssueTypeId", () => {
  it("picks the type used last", () => {
    expect(pickIssueTypeId(types, "bug")).toBe("bug");
  });

  it("falls back to the first type", () => {
    expect(pickIssueTypeId(types, undefined)).toBe("task");
    expect(pickIssueTypeId(types, "unlinked")).toBe("task");
  });

  it("has nothing to pick before the types are loaded", () => {
    expect(pickIssueTypeId(undefined, "bug")).toBeUndefined();
    expect(pickIssueTypeId([], "bug")).toBeUndefined();
  });
});
