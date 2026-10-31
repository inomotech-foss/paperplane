// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { ApiSchema } from "@plane/api-types";
import { toProjectView, toViewCreateBody, toViewUpdateBody, toWorkspaceView } from "./view-convert";

const row: ApiSchema<"IssueView"> = {
  id: "v1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  deleted_at: null,
  name: "Mine",
  description: "",
  query: {},
  filters: {},
  display_filters: { layout: "kanban", unknown: 1 },
  display_properties: { key: true },
  rich_filters: { priority__in: "high" },
  access: 1,
  sort_order: 65535,
  logo_props: { in_use: "emoji", emoji: { value: "1" } },
  is_locked: false,
  archived_at: null,
  created_by: "u1",
  updated_by: null,
  workspace: "w1",
  project: null,
  owned_by: "u1",
};

describe("toWorkspaceView", () => {
  it("parses the client-owned filters and leaves out is_favorite when it is not sent", () => {
    const view = toWorkspaceView(row);
    expect(view).toMatchObject({ id: "v1", access: 1, project: null, display_properties: { key: true } });
    expect(view.display_filters.layout).toBe("kanban");
    expect(view.rich_filters).toEqual({ priority__in: "high" });
    expect("is_favorite" in view).toBe(false);
  });

  it("keeps is_favorite when it is sent", () => {
    expect(toWorkspaceView({ ...row, is_favorite: true }).is_favorite).toBe(true);
  });

  it("falls back per field for malformed filters", () => {
    const view = toWorkspaceView({ ...row, display_filters: { layout: 3, order_by: "-created_at" } });
    expect(view.display_filters.layout).toBeUndefined();
    expect(view.display_filters.order_by).toBe("-created_at");
  });
});

describe("toProjectView", () => {
  it("uses the project of the path when the row has none and parses the logo", () => {
    const view = toProjectView(row, "p1");
    expect(view.project).toBe("p1");
    expect(view.logo_props).toEqual({ in_use: "emoji", emoji: { value: "1" } });
    expect(toProjectView({ ...row, project: "p2" }, "p1").project).toBe("p2");
  });
});

describe("toViewUpdateBody", () => {
  it("drops the fields the endpoint does not accept", () => {
    const body = toViewUpdateBody({ ...toProjectView(row, "p1"), name: "N" });
    expect(body).toEqual({
      name: "N",
      description: "",
      rich_filters: { priority__in: "high" },
      display_filters: expect.objectContaining({ layout: "kanban" }),
      display_properties: { key: true },
      logo_props: { in_use: "emoji", emoji: { value: "1" } },
    });
  });

  it("sends an empty name on create when none is given", () => {
    expect(toViewCreateBody({}).name).toBe("");
  });
});
