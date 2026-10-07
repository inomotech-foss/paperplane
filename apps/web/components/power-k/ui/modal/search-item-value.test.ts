/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { getSearchItemValue } from "./search-item-value";

describe("getSearchItemValue", () => {
  it("includes the identifier for projects", () => {
    const value = getSearchItemValue("project", {
      id: "p1",
      identifier: "INOMO2",
      name: "Inomo",
      workspace__slug: "ws",
    });
    expect(value.toLowerCase()).toContain("inomo2");
  });

  it("includes the project identifier and sequence id for work items", () => {
    const value = getSearchItemValue("issue", {
      id: "i1",
      name: "Bug",
      project__identifier: "WEB",
      project_id: "p1",
      sequence_id: 42,
      workspace__slug: "ws",
      type_id: "t1",
    });
    expect(value).toContain("WEB");
    expect(value).toContain("42");
  });

  it("includes all project identifiers for pages", () => {
    const value = getSearchItemValue("page", {
      id: "pg1",
      name: "Notes",
      project_ids: ["p1", "p2"],
      project_identifiers: ["ALPHA", "BETA"],
      workspace__slug: "ws",
    });
    expect(value).toContain("ALPHA");
    expect(value).toContain("BETA");
  });
});
