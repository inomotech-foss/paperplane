// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import {
  isIssueCustomPropertyValue,
  parseBulkPropertyValues,
  parseDerivationConfig,
  parseIssueCustomProperty,
  parsePropertyValueMap,
  parsePropertyValuesResponse,
} from "./issue-custom-property-parse";

describe("parseDerivationConfig", () => {
  it("keeps lookup and rollup settings", () => {
    const lookup = { issue_type: "t1", source: "item", include_self: true };
    const rollup = { source: "items", function: "count", scope: "children", issue_type: null, include_self: false };
    expect(parseDerivationConfig(lookup)).toEqual(lookup);
    expect(parseDerivationConfig(rollup)).toEqual(rollup);
  });

  it("falls back to no settings", () => {
    expect(parseDerivationConfig({})).toEqual({});
    expect(parseDerivationConfig(null)).toEqual({});
    expect(parseDerivationConfig({ source: "items", function: "median" })).toEqual({});
  });
});

describe("property values", () => {
  it("accepts the value shapes the client shows", () => {
    for (const value of ["a", 1, true, null, ["a", "b"]]) expect(isIssueCustomPropertyValue(value)).toBe(true);
    for (const value of [undefined, {}, [1], [null]]) expect(isIssueCustomPropertyValue(value)).toBe(false);
  });

  it("drops entries with other shapes", () => {
    expect(parsePropertyValueMap({ a: "x", b: { nested: true }, c: ["y"] })).toEqual({ a: "x", c: ["y"] });
    expect(parsePropertyValueMap("nope")).toEqual({});
  });

  it("parses the single and the bulk responses", () => {
    expect(
      parsePropertyValuesResponse({
        values: { p1: "x", p2: { bad: 1 } },
        display: { p1: "X" },
        derived: { p1: { source_issue_id: "i2" } },
      })
    ).toEqual({ values: { p1: "x" }, display: { p1: "X" }, derived: { p1: { source_issue_id: "i2" } } });
    expect(parseBulkPropertyValues({ i1: { p1: 2 }, i2: null })).toEqual({ i1: { p1: 2 }, i2: {} });
  });
});

describe("parseIssueCustomProperty", () => {
  it("reads a blank relation type as none and narrows the JSON fields", () => {
    const property = parseIssueCustomProperty({
      id: "p1",
      options: [],
      created_at: "",
      updated_at: "",
      deleted_at: null,
      name: "Owner",
      display_name: "Owner",
      property_type: "TEXT",
      is_multi: false,
      relation_type: "",
      is_active: true,
      is_required: false,
      sort_order: 1,
      settings: "bad",
      external_source: null,
      external_id: null,
      derivation: "NONE",
      derivation_config: { stale: true },
      created_by: null,
      updated_by: null,
      project: "pr1",
      workspace: "w1",
      issue_type: null,
    });
    expect(property).toMatchObject({ relation_type: null, settings: {}, derivation_config: {} });
  });
});
