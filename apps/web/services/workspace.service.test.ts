// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import type { ApiSchema } from "@plane/api-types";
import { DEFAULT_LOGO_PROPS } from "@plane/types";
import { toRecentVisits } from "./workspace.service";

const visit = (
  entity_name: string,
  entity_data: ApiSchema<"RecentVisitEntity"> | null
): ApiSchema<"WorkspaceRecentVisit"> => ({
  id: `v-${entity_name}`,
  entity_name,
  entity_identifier: "e1",
  entity_data,
  visited_at: "2026-01-01T00:00:00Z",
});

const project = { id: "p1", name: "P", logo_props: { in_use: "emoji" }, project_members: [], identifier: "P" };

describe("toRecentVisits", () => {
  it("leaves out entity types the home page cannot show", () => {
    expect(toRecentVisits([visit("cycle", null), visit("project", project)]).map((v) => v.entity_name)).toEqual([
      "project",
    ]);
  });

  it("parses the logo of the entity", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const [parsed] = toRecentVisits([visit("project", { ...project, logo_props: { in_use: "sticker" } })]);
    expect(parsed?.entity_data).toMatchObject({ id: "p1", logo_props: DEFAULT_LOGO_PROPS });
    warn.mockRestore();
  });

  it("keeps a visit whose entity is gone", () => {
    expect(toRecentVisits([visit("issue", null)])[0]?.entity_data).toBeNull();
  });
});
