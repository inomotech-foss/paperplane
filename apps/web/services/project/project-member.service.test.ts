// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { ApiSchema } from "@plane/api-types";
import { toMemberships } from "./project-member.service";

const row: ApiSchema<"ProjectMemberRole"> & { member: string } = {
  id: "pm1",
  role: 15,
  member: "u1",
  project: "p1",
  original_role: 15,
  created_at: "2026-01-01",
};

describe("toMemberships", () => {
  it("keeps the rows of existing users", () => {
    expect(toMemberships([row])).toEqual([row]);
  });

  it("leaves out rows without a member", () => {
    expect(toMemberships([row, { ...row, id: "pm2", member: null }])).toEqual([row]);
  });
});
