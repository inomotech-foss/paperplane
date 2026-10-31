// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { toDraftIssueBody, toDraftToIssueBody } from "./workspace_draft.service";

describe("draft bodies", () => {
  it("sends cleared fields as null and keeps the type", () => {
    expect(toDraftIssueBody({ name: "D", state_id: undefined, type_id: "t1", module_ids: ["m1"] })).toEqual({
      name: "D",
      state_id: null,
      type_id: "t1",
      module_ids: ["m1"],
    });
  });

  it("requires a type to move a draft", () => {
    expect(() => toDraftToIssueBody({ name: "D" })).toThrow();
    expect(toDraftToIssueBody({ name: "D", type_id: "t1", project_id: "p1" })).toEqual({ name: "D", type_id: "t1" });
  });
});
