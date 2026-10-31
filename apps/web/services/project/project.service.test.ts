// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { projectCreateBody, projectUpdateBody } from "./project.service";

const strip = (value: object): unknown => JSON.parse(JSON.stringify(value));

const lead = { id: "u1", avatar_url: null, display_name: "a", first_name: "A", last_name: "B", is_bot: false };

describe("projectUpdateBody", () => {
  it("keeps the writable fields and drops the read-only ones", () => {
    expect(
      strip(projectUpdateBody({ name: "P", inbox_view: true, cover_image_url: "https://x", is_favorite: true }))
    ).toEqual({ name: "P", inbox_view: true });
  });

  it("sends the ids of expanded users", () => {
    expect(projectUpdateBody({ project_lead: lead, default_assignee: null })).toMatchObject({
      project_lead: "u1",
      default_assignee: null,
    });
  });

  it("drops a network or timezone the API does not accept", () => {
    expect(strip(projectUpdateBody({ network: 1, timezone: "Mars/Olympus" }))).toEqual({});
    expect(projectUpdateBody({ network: 2, timezone: "UTC" })).toMatchObject({ network: 2, timezone: "UTC" });
  });
});

describe("projectCreateBody", () => {
  it("sends the intake flag as intake_view", () => {
    expect(strip(projectCreateBody({ name: "P", identifier: "P", inbox_view: true }))).toEqual({
      name: "P",
      identifier: "P",
      intake_view: true,
    });
  });
});
