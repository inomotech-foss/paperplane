// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { TIssueCustomProperty } from "@plane/types";
import type { TTypeMigrationProperty } from "@/services/issue/issue-type-migration.service";
import { getCompatibleTargets, getUnmatchedOptions, isMappingComplete, toPropertyMapping } from "./type-migration";

const makeProperty = (id: string, fields: Partial<TIssueCustomProperty>): TIssueCustomProperty => ({
  id,
  name: id,
  display_name: id,
  property_type: "OPTION",
  is_multi: false,
  relation_type: null,
  is_active: true,
  is_required: false,
  sort_order: 0,
  settings: {},
  options: [],
  project: "p1",
  workspace: "ws",
  issue_type: "bug",
  derivation: "NONE",
  derivation_config: {},
  ...fields,
});

const option = (id: string, name: string) => ({
  id,
  name,
  sort_order: 0,
  is_default: false,
  property: "",
  project: "p1",
  workspace: "ws",
});

const level: TTypeMigrationProperty = {
  id: "level",
  project_id: "p1",
  name: "Level",
  property_type: "OPTION",
  is_multi: false,
  relation_type: null,
  work_items: 2,
  options: [
    { id: "high", name: "High", work_items: 1 },
    { id: "low", name: "Low", work_items: 1 },
  ],
};

const severity = makeProperty("severity", { options: [option("s-high", "High"), option("s-medium", "Medium")] });
const getProperty = (id: string) => (id === "severity" ? severity : null);

describe("getCompatibleTargets", () => {
  it("offers properties of the new type or of every type with the same kind", () => {
    const shared = makeProperty("shared", { issue_type: null });
    const otherType = makeProperty("other", { issue_type: "task" });
    const multi = makeProperty("multi", { is_multi: true });
    const text = makeProperty("text", { property_type: "TEXT" });
    const computed = makeProperty("computed", { derivation: "ROLLUP" });
    const elsewhere = makeProperty("elsewhere", { project: "p2" });

    const targets = getCompatibleTargets(level, [severity, shared, otherType, multi, text, computed, elsewhere], "bug");

    expect(targets.map((target) => target.id)).toEqual(["severity", "shared"]);
  });
});

describe("getUnmatchedOptions", () => {
  it("leaves out the options with the same name", () => {
    expect(getUnmatchedOptions(level, severity).map((entry) => entry.name)).toEqual(["Low"]);
  });
});

describe("isMappingComplete", () => {
  it("needs a decision for every property and every unmatched option", () => {
    expect(isMappingComplete([level], {}, getProperty)).toBe(false);
    expect(
      isMappingComplete([level], { level: { kind: "target", targetId: "severity", options: {} } }, getProperty)
    ).toBe(false);
    expect(
      isMappingComplete(
        [level],
        { level: { kind: "target", targetId: "severity", options: { low: null } } },
        getProperty
      )
    ).toBe(true);
    expect(isMappingComplete([level], { level: { kind: "drop" } }, getProperty)).toBe(true);
  });
});

describe("toPropertyMapping", () => {
  it("writes the decisions in the shape of the API", () => {
    expect(
      toPropertyMapping({
        level: { kind: "target", targetId: "severity", options: { low: "s-medium" } },
        size: { kind: "drop" },
        undecided: undefined,
      })
    ).toEqual({ level: { target: "severity", options: { low: "s-medium" } }, size: { drop: true } });
  });
});
