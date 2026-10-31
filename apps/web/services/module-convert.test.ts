// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { ApiSchema } from "@plane/api-types";
import { toModule, toModuleCreateBody, toModuleLink, toModuleLinkBody, toModuleUpdateBody } from "./module-convert";

const base = {
  id: "m1",
  workspace_id: "w1",
  project_id: "p1",
  name: "Module",
  description: "",
  description_text: null,
  description_html: null,
  start_date: null,
  target_date: null,
  lead_id: null,
  view_props: {},
  sort_order: 1,
  external_source: null,
  external_id: null,
  is_favorite: false,
  created_at: "c",
  updated_at: "u",
};

const listItem: ApiSchema<"ModuleListItem"> = {
  ...base,
  status: "planned",
  member_ids: ["u1"],
  logo_props: { in_use: "emoji", emoji: { value: "1" } },
  completed_estimate_points: 1,
  total_estimate_points: 3,
  total_issues: 4,
  cancelled_issues: 0,
  completed_issues: 1,
  started_issues: 1,
  unstarted_issues: 1,
  backlog_issues: 1,
};

const link: ApiSchema<"ModuleLink"> = {
  id: "l1",
  created_at: "c",
  updated_at: "u",
  deleted_at: null,
  title: null,
  url: "https://a.test",
  metadata: { title: "A", junk: 1 },
  created_by: null,
  updated_by: null,
  project: "p1",
  workspace: "w1",
  module: "m1",
};

describe("toModule", () => {
  it("keeps the fields of a list row", () => {
    const module = toModule(listItem);
    expect(module).toMatchObject({ status: "planned", total_issues: 4, total_estimate_points: 3, member_ids: ["u1"] });
    expect(module.logo_props).toEqual({ in_use: "emoji", emoji: { value: "1" } });
    expect(module).not.toHaveProperty("archived_at");
    expect(module).not.toHaveProperty("backlog_estimate_points");
  });

  it("reads null counts of an archived row as 0", () => {
    const archived: ApiSchema<"ArchivedModuleListItem"> = {
      ...base,
      status: "completed",
      member_ids: [],
      total_issues: null,
      cancelled_issues: null,
      completed_issues: 2,
      started_issues: null,
      unstarted_issues: null,
      backlog_issues: null,
      archived_at: "a",
    };
    expect(toModule(archived)).toMatchObject({ total_issues: 0, completed_issues: 2, archived_at: "a" });
    expect(toModule(archived)).not.toHaveProperty("logo_props");
  });
});

describe("module links and bodies", () => {
  it("converts a link and checks its metadata", () => {
    expect(toModuleLink(link)).toEqual({
      id: "l1",
      title: null,
      url: "https://a.test",
      metadata: { title: "A" },
      created_at: "c",
      created_by: null,
    });
    expect(toModuleLinkBody({ title: "T" })).toEqual({ title: "T", url: "" });
  });

  it("sends only the writable module fields", () => {
    const body = toModuleUpdateBody({ ...toModule(listItem), sort_order: 2 });
    const sent = Object.entries(body).filter(([, value]) => value !== undefined);
    expect(sent.map(([key]) => key).sort()).toEqual([
      "description",
      "lead_id",
      "logo_props",
      "member_ids",
      "name",
      "sort_order",
      "start_date",
      "status",
      "target_date",
    ]);
    expect(toModuleCreateBody({}).name).toBe("");
  });
});
