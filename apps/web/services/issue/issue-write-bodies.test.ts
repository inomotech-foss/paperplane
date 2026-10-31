// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { labelCreateBody, labelUpdateBody } from "./issue_label.service";
import { issueTypeCreateBody, issueTypeUpdateBody } from "./issue_type.service";

describe("label bodies", () => {
  it("keeps only the writable fields", () => {
    expect(labelUpdateBody({ id: "l1", project_id: "p1", sort_order: 2, parent: null })).toEqual({
      name: undefined,
      color: undefined,
      parent: null,
      sort_order: 2,
    });
  });

  it("needs a name to create", () => {
    expect(labelCreateBody({ name: "bug", color: "#f00" })).toMatchObject({ name: "bug", color: "#f00" });
    expect(() => labelCreateBody({ color: "#f00" })).toThrow("A label needs a name");
  });
});

describe("work item type bodies", () => {
  it("keeps only the writable fields", () => {
    expect(issueTypeUpdateBody({ id: "t1", workspace: "w1", is_active: false })).toEqual({
      name: undefined,
      description: undefined,
      logo_props: undefined,
      is_active: false,
      level: undefined,
    });
  });

  it("needs a name to create", () => {
    expect(issueTypeCreateBody({ name: "Bug", level: 1 })).toMatchObject({ name: "Bug", level: 1 });
    expect(() => issueTypeCreateBody({ level: 1 })).toThrow("A work item type needs a name");
  });
});
