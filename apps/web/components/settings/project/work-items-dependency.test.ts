/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { GROUPED_PROJECT_SETTINGS, PROJECT_SETTINGS_CATEGORY, PROJECT_SETTINGS_FLAT_MAP } from "@plane/constants";
import {
  FEATURE_NEEDS_WORK_ITEMS,
  filterVisibleProjectSettings,
  findProjectSetting,
  isProjectFeatureEnabled,
  isProjectSettingVisible,
  isWorkItemsEnabled,
} from "./work-items-dependency";

const enabled = { issue_view: true };
const disabled = { issue_view: false };
const keys = (category: PROJECT_SETTINGS_CATEGORY, project: { issue_view: boolean }) =>
  filterVisibleProjectSettings(GROUPED_PROJECT_SETTINGS[category], project).map((item) => item.key);

describe("isWorkItemsEnabled", () => {
  it("treats an unknown project as enabled", () => {
    expect(isWorkItemsEnabled(undefined)).toBe(true);
    expect(isWorkItemsEnabled(null)).toBe(true);
  });

  it("follows issue_view", () => {
    expect(isWorkItemsEnabled(enabled)).toBe(true);
    expect(isWorkItemsEnabled(disabled)).toBe(false);
  });
});

describe("isProjectFeatureEnabled", () => {
  it("needs both work items and the feature", () => {
    expect(isProjectFeatureEnabled({ issue_view: true, cycle_view: true }, "cycle_view")).toBe(true);
    expect(isProjectFeatureEnabled({ issue_view: false, cycle_view: true }, "cycle_view")).toBe(false);
    expect(isProjectFeatureEnabled({ issue_view: true, cycle_view: false }, "cycle_view")).toBe(false);
  });

  it("treats an unknown project as disabled", () => {
    expect(isProjectFeatureEnabled(undefined, "inbox_view")).toBe(false);
  });
});

describe("work items dependency decisions", () => {
  it("has an explicit decision for every Features entry", () => {
    const decided = Object.keys(FEATURE_NEEDS_WORK_ITEMS);
    for (const item of GROUPED_PROJECT_SETTINGS[PROJECT_SETTINGS_CATEGORY.FEATURES]) {
      expect(decided, `decide whether ${item.key} needs work items`).toContain(item.key);
    }
  });

  it("puts every setting in a category", () => {
    const grouped = Object.values(GROUPED_PROJECT_SETTINGS)
      .flat()
      .map((item) => item.key);
    for (const item of PROJECT_SETTINGS_FLAT_MAP) expect(grouped).toContain(item.key);
  });
});

describe("isProjectSettingVisible", () => {
  it("keeps the work items page itself visible", () => {
    expect(isProjectSettingVisible("features_work_items", disabled)).toBe(true);
  });

  it("hides dependent settings only when work items are off", () => {
    expect(isProjectSettingVisible("features_cycles", enabled)).toBe(true);
    expect(isProjectSettingVisible("features_cycles", disabled)).toBe(false);
  });
});

describe("filterVisibleProjectSettings", () => {
  it("shows everything when work items are on", () => {
    for (const category of Object.values(PROJECT_SETTINGS_CATEGORY)) {
      expect(keys(category, enabled)).toEqual(GROUPED_PROJECT_SETTINGS[category].map((item) => item.key));
    }
  });

  it("keeps only independent settings when work items are off", () => {
    expect(keys(PROJECT_SETTINGS_CATEGORY.GENERAL, disabled)).toEqual(["general", "members"]);
    expect(keys(PROJECT_SETTINGS_CATEGORY.FEATURES, disabled)).toEqual(["features_work_items", "features_pages"]);
    expect(keys(PROJECT_SETTINGS_CATEGORY.WORK_STRUCTURE, disabled)).toEqual([]);
    expect(keys(PROJECT_SETTINGS_CATEGORY.EXECUTION, disabled)).toEqual([]);
  });
});

describe("findProjectSetting", () => {
  const baseUrl = "/ws/settings/projects/p1";

  it("matches with or without a trailing slash", () => {
    expect(findProjectSetting(PROJECT_SETTINGS_FLAT_MAP, `${baseUrl}/states`, baseUrl)?.key).toBe("states");
    expect(findProjectSetting(PROJECT_SETTINGS_FLAT_MAP, `${baseUrl}/states/`, baseUrl)?.key).toBe("states");
  });

  it("matches nested automation routes", () => {
    expect(findProjectSetting(PROJECT_SETTINGS_FLAT_MAP, `${baseUrl}/automations/a1/`, baseUrl)?.key).toBe(
      "automations"
    );
  });

  it("returns undefined for unknown paths", () => {
    expect(findProjectSetting(PROJECT_SETTINGS_FLAT_MAP, `${baseUrl}/unknown/`, baseUrl)).toBeUndefined();
  });
});
