// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { ApiSchema } from "@plane/api-types";
import { EPageAccess } from "@plane/types";
import {
  toPage,
  toPageAttachment,
  toPageComment,
  toPageCreateBody,
  toPageUpdateBody,
  toPageVersion,
} from "./page-convert";

const row: ApiSchema<"Page"> = {
  id: "p1",
  name: "Page",
  owned_by: "u1",
  access: 1,
  color: "",
  parent: null,
  sort_order: 1,
  is_locked: false,
  archived_at: null,
  workspace: "w1",
  created_at: "c",
  updated_at: "u",
  created_by: null,
  updated_by: null,
  view_props: {},
  logo_props: { in_use: "nope" },
  label_ids: ["l1"],
  project_ids: ["pr1"],
};

describe("toPage", () => {
  it("maps the access and falls back for a bad logo", () => {
    const page = toPage(row);
    expect(page).toMatchObject({ access: EPageAccess.PRIVATE, is_favorite: false, label_ids: ["l1"] });
    expect(page.logo_props).toEqual({ in_use: "emoji" });
  });

  it("only sets the description when the endpoint sends it", () => {
    expect(toPage(row)).not.toHaveProperty("description_html");
    expect(toPage({ ...row, description_html: "<p>x</p>" }).description_html).toBe("<p>x</p>");
  });
});

describe("page bodies", () => {
  it("sends the labels as label ids and no position fields on update", () => {
    const page = { ...toPage(row), parent: "p0", sort_order: 5 };
    expect(toPageCreateBody(page)).toMatchObject({ labels: ["l1"], parent: "p0", sort_order: 5 });
    const update = toPageUpdateBody(page);
    expect(update).not.toHaveProperty("parent");
    expect(update).not.toHaveProperty("sort_order");
    expect(update.labels).toEqual(["l1"]);
  });
});

describe("versions, comments and attachments", () => {
  const base = {
    id: "v1",
    workspace: "w1",
    page: "p1",
    last_saved_at: "s",
    owned_by: "u1",
    created_at: "c",
    updated_at: "u",
    created_by: null,
    updated_by: null,
  };

  it("keeps the version description only on the detail", () => {
    expect(toPageVersion(base)).not.toHaveProperty("description_html");
    const detail = toPageVersion({
      ...base,
      description_binary: null,
      description_html: "<p/>",
      description_json: "x",
    });
    expect(detail).toMatchObject({ description_html: "<p/>", description_json: {} });
  });

  it("drops a missing actor and checks the comment document", () => {
    const comment = toPageComment({
      id: "c1",
      page: "p1",
      workspace: "w1",
      parent: null,
      anchor_id: null,
      comment_html: "<p/>",
      comment_json: { type: "doc" },
      comment_stripped: "",
      actor: null,
      actor_detail: null,
      comment_reactions: [],
      is_resolved: false,
      resolved_at: null,
      resolved_by: null,
      resolved_by_detail: null,
      edited_at: null,
      external_id: null,
      external_source: null,
      created_by: null,
      updated_by: null,
      created_at: "c",
      updated_at: "u",
    });
    expect(comment).not.toHaveProperty("actor_detail");
    expect(comment.comment_json).toEqual({ type: "doc" });
  });

  it("keeps the attachment attributes", () => {
    const attachment = toPageAttachment({
      id: "a1",
      attributes: { name: "a.png", size: 7 },
      asset_url: null,
      created_at: "c",
      updated_at: "u",
      deleted_at: null,
      asset: "k",
      entity_type: null,
      entity_identifier: null,
      is_deleted: false,
      is_archived: false,
      external_id: null,
      external_source: null,
      size: 7,
      is_uploaded: true,
      storage_metadata: null,
      created_by: null,
      updated_by: null,
      user: null,
      workspace: null,
      draft_issue: null,
      project: null,
      issue: null,
      comment: null,
      page: "p1",
      page_comment: null,
    });
    expect(attachment).toMatchObject({ attributes: { name: "a.png", size: 7 }, page: "p1" });
  });
});
