import { describe, expect, it } from "vitest";
import type { TIssueCustomProperty } from "@plane/types";
import {
  getOptionsProperty,
  getRollupFunctions,
  getRollupResultType,
  isComputedProperty,
  isDerivationSource,
  isWorkItemReferenceProperty,
} from "./derivation";

const property = (fields: Partial<TIssueCustomProperty>): TIssueCustomProperty => ({
  id: "p",
  name: "p",
  display_name: "P",
  property_type: "TEXT",
  is_multi: false,
  relation_type: null,
  is_active: true,
  is_required: false,
  sort_order: 0,
  settings: {},
  options: [],
  project: "project",
  workspace: "workspace",
  issue_type: null,
  derivation: "NONE",
  derivation_config: {},
  ...fields,
});

describe("derivation helpers", () => {
  it("only looked up and rolled up properties are computed", () => {
    expect(isComputedProperty(property({ derivation: "LOOKUP" }))).toBe(true);
    expect(isComputedProperty(property({ derivation: "ROLLUP" }))).toBe(true);
    expect(isComputedProperty(property({ derivation: "INHERIT" }))).toBe(false);
    expect(isComputedProperty(property({}))).toBe(false);
    expect(isComputedProperty(undefined)).toBe(false);
  });

  it("recognises a work item reference", () => {
    expect(isWorkItemReferenceProperty(property({ property_type: "RELATION", relation_type: "ISSUE" }))).toBe(true);
    expect(isWorkItemReferenceProperty(property({ property_type: "RELATION", relation_type: "USER" }))).toBe(false);
  });

  it("offers the functions that fit the source, like the API", () => {
    expect(getRollupFunctions("items", null)).toEqual(["count"]);
    expect(getRollupFunctions("start_date", null)).toEqual(["earliest", "latest", "count"]);
    expect(getRollupFunctions("x", property({ property_type: "DECIMAL" }))).toEqual([
      "sum",
      "avg",
      "min",
      "max",
      "count",
    ]);
    expect(getRollupFunctions("x", property({ property_type: "BOOLEAN" }))).toEqual([
      "count_true",
      "percent_true",
      "count",
    ]);
    expect(getRollupFunctions("x", property({ property_type: "OPTION" }))).toEqual(["count"]);
    expect(getRollupFunctions("x", undefined)).toEqual([]);
  });

  it("earliest and latest give dates, everything else numbers", () => {
    expect(getRollupResultType("earliest")).toBe("DATETIME");
    expect(getRollupResultType("latest")).toBe("DATETIME");
    expect(getRollupResultType("sum")).toBe("DECIMAL");
    expect(getRollupResultType("percent_true")).toBe("DECIMAL");
  });

  it("only people-set and inherited properties can be sources", () => {
    expect(isDerivationSource(property({}))).toBe(true);
    expect(isDerivationSource(property({ derivation: "INHERIT" }))).toBe(true);
    expect(isDerivationSource(property({ derivation: "ROLLUP" }))).toBe(false);
  });

  it("a look-up of an option property uses the source's options", () => {
    const industry = property({ id: "industry", property_type: "OPTION" });
    const lookup = property({
      property_type: "OPTION",
      derivation: "LOOKUP",
      derivation_config: { issue_type: "customer", source: "industry", include_self: true },
    });
    const byId = (id: string) => (id === "industry" ? industry : null);

    expect(getOptionsProperty(lookup, byId)).toBe(industry);
    expect(getOptionsProperty(industry, byId)).toBe(industry);
  });
});
