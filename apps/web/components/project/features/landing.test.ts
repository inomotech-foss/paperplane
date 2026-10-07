// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { EUserPermissions } from "@plane/constants";
import type { TProjectFeatureProject } from "./features";
import { resolveProjectLanding } from "./landing";

const allOn: TProjectFeatureProject = {
  issue_view: true,
  cycle_view: true,
  module_view: true,
  issue_views_view: true,
  page_view: true,
  inbox_view: true,
};
const allOff: TProjectFeatureProject = {
  issue_view: false,
  cycle_view: false,
  module_view: false,
  issue_views_view: false,
  page_view: false,
  inbox_view: false,
};
const { ADMIN, MEMBER, GUEST } = EUserPermissions;

const landing = (project: TProjectFeatureProject, role: EUserPermissions | undefined, preferred?: string | null) =>
  resolveProjectLanding(project, role, preferred)?.key ?? null;

describe("resolveProjectLanding", () => {
  it("uses the preferred tab when it is enabled", () => {
    expect(landing(allOn, MEMBER, "pages")).toBe("pages");
    expect(landing(allOn, ADMIN, "intake")).toBe("intake");
  });

  it("ignores the preferred tab when it is disabled", () => {
    expect(landing({ ...allOn, page_view: false }, MEMBER, "pages")).toBe("work_items");
  });

  it("ignores an unknown or missing preferred tab", () => {
    expect(landing(allOn, MEMBER, "epics")).toBe("work_items");
    expect(landing(allOn, MEMBER, "")).toBe("work_items");
    expect(landing(allOn, MEMBER, null)).toBe("work_items");
    expect(landing(allOn, MEMBER, undefined)).toBe("work_items");
  });

  it("ignores a preferred tab the role cannot open", () => {
    expect(landing(allOn, GUEST, "cycles")).toBe("work_items");
    expect(landing(allOn, GUEST, "modules")).toBe("work_items");
    expect(landing(allOn, MEMBER, "cycles")).toBe("cycles");
  });

  it("treats work item features as off when work items are off", () => {
    const workItemsOff = { ...allOn, issue_view: false };
    expect(landing(workItemsOff, ADMIN, "cycles")).toBe("pages");
    expect(landing(workItemsOff, ADMIN, "views")).toBe("pages");
    expect(landing(workItemsOff, ADMIN, "intake")).toBe("pages");
    expect(landing(workItemsOff, ADMIN, "work_items")).toBe("pages");
  });

  it("returns null when nothing is enabled", () => {
    expect(landing(allOff, ADMIN, "work_items")).toBeNull();
    expect(landing({ ...allOn, issue_view: false, page_view: false }, ADMIN, "pages")).toBeNull();
  });

  it("returns null without a role", () => {
    expect(landing(allOn, undefined, "work_items")).toBeNull();
  });

  it("falls back in sidebar order", () => {
    expect(landing({ ...allOff, issue_view: true, page_view: true }, GUEST, null)).toBe("work_items");
    expect(landing({ ...allOff, issue_view: true, inbox_view: true }, MEMBER, "pages")).toBe("work_items");
    expect(landing({ ...allOff, page_view: true }, GUEST, "work_items")).toBe("pages");
  });
});
