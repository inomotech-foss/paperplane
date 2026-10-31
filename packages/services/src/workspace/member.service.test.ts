// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import type { ApiSchema } from "@plane/api-types";
import { DEFAULT_WORKSPACE_VIEW_PROPS } from "@plane/types";
import { toWorkspaceMemberMe } from "./member.service";

const member: ApiSchema<"WorkspaceMemberMe"> = {
  id: "m1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
  role: 15,
  company_role: null,
  view_props: { display_filters: { layout: "list" } },
  default_props: {},
  issue_props: {},
  is_active: true,
  getting_started_checklist: {},
  tips: {},
  explored_features: {},
  pql_dialect: null,
  created_by: null,
  updated_by: null,
  workspace: "w1",
  member: "u1",
};

describe("toWorkspaceMemberMe", () => {
  it("parses the view props and keeps the other fields", () => {
    const parsed = toWorkspaceMemberMe(member);
    expect(parsed.view_props).toEqual({ ...DEFAULT_WORKSPACE_VIEW_PROPS, display_filters: { layout: "list" } });
    expect(parsed.default_props).toEqual(DEFAULT_WORKSPACE_VIEW_PROPS);
    expect(parsed).toMatchObject({ id: "m1", role: 15, pql_dialect: null });
  });

  it("falls back to the default for malformed view props", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(toWorkspaceMemberMe({ ...member, view_props: { display_filters: { layout: "board" } } }).view_props).toEqual(
      DEFAULT_WORKSPACE_VIEW_PROPS
    );
    warn.mockRestore();
  });
});
