/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import type { TPublishSettingsResponse } from "@/services/project.service";
import { parseLogoProps, parseViewProps, toPublishSettings } from "./publish.helper";

const response: TPublishSettingsResponse = {
  id: "d1",
  project_details: {
    id: "p1",
    identifier: "PP",
    name: "Paper",
    cover_image: null,
    cover_image_url: null,
    logo_props: { in_use: "emoji", emoji: { value: "128512" } },
    description: "",
  },
  workspace_detail: { id: "w1", name: "W", slug: "w", logo_url: null },
  created_at: "2026-10-01",
  updated_at: "2026-10-01",
  deleted_at: null,
  entity_identifier: "p1",
  entity_name: "project",
  anchor: "abc",
  is_comments_enabled: true,
  is_reactions_enabled: false,
  is_votes_enabled: true,
  view_props: { list: true, kanban: false },
  is_activity_enabled: false,
  is_disabled: false,
  created_by: null,
  updated_by: null,
  workspace: "w1",
  project: "p1",
  intake: null,
  intake_issue_type: null,
};

describe("toPublishSettings", () => {
  it("maps the response to the store shape", () => {
    const settings = toPublishSettings(response);

    expect(settings).toMatchObject({
      anchor: "abc",
      entity_name: "project",
      created_by: undefined,
      project: "p1",
      view_props: { list: true, kanban: false },
      workspace_detail: { slug: "w" },
    });
    expect(settings.project_details?.logo_props).toEqual({ in_use: "emoji", emoji: { value: "128512" } });
  });

  it("drops an unknown entity name", () => {
    expect(toPublishSettings({ ...response, entity_name: "cycle" }).entity_name).toBeUndefined();
  });
});

describe("parseViewProps", () => {
  it("keeps the valid flags when one is invalid", () => {
    expect(parseViewProps({ list: "yes", kanban: true, gantt: false, other: true })).toEqual({
      kanban: true,
      gantt: false,
    });
  });

  it("returns undefined when the value is not an object", () => {
    expect(parseViewProps(null)).toBeUndefined();
    expect(parseViewProps([true])).toBeUndefined();
  });
});

describe("parseLogoProps", () => {
  it("falls back to an empty logo", () => {
    expect(parseLogoProps({ in_use: "image" })).toEqual({ in_use: "emoji" });
  });
});
