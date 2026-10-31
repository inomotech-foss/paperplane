// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { ApiSchema } from "@plane/api-types";
import { publishCreateBody, publishUpdateBody, toPublishSettings } from "./project-publish.service";

const unpublished: ApiSchema<"UnpublishedDeployBoard"> = {
  deleted_at: null,
  is_comments_enabled: false,
  is_reactions_enabled: false,
  is_votes_enabled: false,
  view_props: null,
  is_activity_enabled: false,
  is_disabled: false,
  created_by: null,
  updated_by: null,
  intake: null,
  intake_issue_type: null,
};

const board: ApiSchema<"DeployBoard"> = {
  ...unpublished,
  id: "b1",
  project_details: null,
  workspace_detail: { id: "w1", name: "W", slug: "ws", logo_url: null },
  view_props: { list: true, kanban: false },
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  entity_identifier: "p1",
  entity_name: "project",
  anchor: "abc",
  workspace: "w1",
  project: "p1",
};

describe("toPublishSettings", () => {
  it("has no anchor for a project that is not published", () => {
    expect(toPublishSettings(unpublished)).toMatchObject({ anchor: undefined, id: undefined, view_props: undefined });
  });

  it("keeps the board of a published project", () => {
    expect(toPublishSettings(board)).toMatchObject({
      anchor: "abc",
      id: "b1",
      entity_name: "project",
      view_props: { list: true, kanban: false },
    });
  });

  it("drops an unknown entity name", () => {
    expect(toPublishSettings({ ...board, entity_name: "cycle" }).entity_name).toBeUndefined();
  });
});

describe("publish bodies", () => {
  const settings = { is_comments_enabled: true, view_props: { list: true } };

  it("sends the layouts as views when publishing", () => {
    expect(publishCreateBody(settings)).toMatchObject({ is_comments_enabled: true, views: { list: true } });
  });

  it("sends the layouts as view_props when updating", () => {
    expect(publishUpdateBody(settings)).toMatchObject({ is_comments_enabled: true, view_props: { list: true } });
  });
});
