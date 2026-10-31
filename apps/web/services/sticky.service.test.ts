// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import type { ApiSchema } from "@plane/api-types";
import { toSticky, toStickyBody } from "./sticky.service";

vi.mock("@/services/api-client", () => ({ apiClient: {} }));

const row: ApiSchema<"Sticky"> = {
  id: "s1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
  name: null,
  description: {},
  description_html: "<p>note</p>",
  description_stripped: "note",
  description_binary: null,
  logo_props: {},
  color: null,
  background_color: "peach",
  sort_order: 1,
  created_by: "u1",
  updated_by: null,
  workspace: "w1",
  owner: "u1",
};

describe("toSticky", () => {
  it("leaves out the null name and editor and parses the logo", () => {
    const sticky = toSticky(row);
    expect("name" in sticky).toBe(false);
    expect("updated_by" in sticky).toBe(false);
    expect(sticky).toMatchObject({ id: "s1", created_by: "u1", background_color: "peach" });
    expect(sticky.logo_props).toEqual({ in_use: "emoji" });
  });
});

describe("toStickyBody", () => {
  it("sends only the fields a sticky write accepts", () => {
    expect(toStickyBody({ ...toSticky(row), sort_order: 2 })).toEqual({
      name: undefined,
      description_html: "<p>note</p>",
      background_color: "peach",
      logo_props: { in_use: "emoji" },
      sort_order: 2,
    });
  });
});
