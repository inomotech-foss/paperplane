// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { EUserPermissions } from "@plane/constants";
import { getProjectNavigationItems } from "@/components/navigation/navigation-items";
import type { TProjectFeatureKey, TProjectFeatureProject } from "./features";
import {
  PROJECT_FEATURES,
  getAvailableProjectFeatures,
  getProjectFeature,
  getProjectUrl,
  isProjectFeatureAllowed,
} from "./features";

const allOn: TProjectFeatureProject = {
  issue_view: true,
  cycle_view: true,
  module_view: true,
  issue_views_view: true,
  page_view: true,
  inbox_view: true,
};
const keys = (project: TProjectFeatureProject, role: EUserPermissions) =>
  getAvailableProjectFeatures(project, role).map((feature) => feature.key);

describe("PROJECT_FEATURES", () => {
  it("lists each feature once", () => {
    const all: TProjectFeatureKey[] = ["work_items", "cycles", "modules", "views", "pages", "intake"];
    expect(PROJECT_FEATURES.map((feature) => feature.key)).toEqual(all);
  });

  it("finds a feature by key", () => {
    expect(getProjectFeature("pages").flag).toBe("page_view");
  });
});

describe("getAvailableProjectFeatures", () => {
  it("keeps sidebar order", () => {
    expect(keys(allOn, EUserPermissions.MEMBER)).toEqual([
      "work_items",
      "cycles",
      "modules",
      "views",
      "pages",
      "intake",
    ]);
  });

  it("hides cycles and modules from guests", () => {
    expect(keys(allOn, EUserPermissions.GUEST)).toEqual(["work_items", "views", "pages", "intake"]);
  });

  it("leaves only pages when work items are off", () => {
    expect(keys({ ...allOn, issue_view: false }, EUserPermissions.ADMIN)).toEqual(["pages"]);
  });

  it("drops features whose flag is off", () => {
    expect(keys({ ...allOn, module_view: false, inbox_view: false }, EUserPermissions.ADMIN)).toEqual([
      "work_items",
      "cycles",
      "views",
      "pages",
    ]);
  });
});

describe("isProjectFeatureAllowed", () => {
  it("accepts roles sent as strings", () => {
    const role = "15" as unknown as EUserPermissions;
    expect(isProjectFeatureAllowed(getProjectFeature("cycles"), role)).toBe(true);
  });

  it("rejects a missing role", () => {
    expect(isProjectFeatureAllowed(getProjectFeature("pages"), undefined)).toBe(false);
  });
});

describe("project urls", () => {
  it("builds the project root url", () => {
    expect(getProjectUrl("acme", "p1")).toBe("/acme/projects/p1");
  });

  it("builds navigation items from the feature list", () => {
    expect(getProjectNavigationItems("acme", "p1", { ...allOn, issue_view: false }, EUserPermissions.GUEST)).toEqual([
      expect.objectContaining({ key: "pages", i18n_key: "sidebar.pages", href: "/acme/projects/p1/pages" }),
    ]);
  });
});
