/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import type { ApiSchema } from "@plane/api-types";
import { toIssue, toVotes } from "./public-issue.helper";

const actor = { id: "u1", first_name: "Ann", last_name: "Lee", avatar: null, avatar_url: null, display_name: "ann" };

const item: ApiSchema<"PublicWorkItemListItem"> = {
  id: "i1",
  name: "Fix",
  state_id: "s1",
  sort_order: 1,
  estimate_point: null,
  priority: "high",
  start_date: null,
  target_date: null,
  sequence_id: 7,
  project_id: "p1",
  parent_id: null,
  cycle_id: null,
  created_by: "u1",
  state__group: "started",
  vote_items: [{ vote: 1, actor_details: actor }],
  reaction_items: null,
};

describe("toIssue", () => {
  it("maps a list item and fills missing id lists", () => {
    const issue = toIssue(item);

    expect(issue.priority).toBe("high");
    expect(issue.label_ids).toEqual([]);
    expect(issue.reaction_items).toEqual([]);
    expect(issue.description_html).toBeUndefined();
    expect(issue.vote_items).toEqual([
      {
        vote: 1,
        actor_details: { id: "u1", first_name: "Ann", last_name: "Lee", display_name: "ann", avatar_url: undefined },
      },
    ]);
  });

  it("falls back to no priority for an unknown value", () => {
    expect(toIssue({ ...item, priority: "critical" }).priority).toBe("none");
  });

  it("keeps the description of a detail item", () => {
    const detail: ApiSchema<"PublicWorkItem"> = {
      ...item,
      module_ids: [],
      label_ids: ["l1"],
      assignee_ids: [],
      description_json: null,
      description_html: "<p>x</p>",
      description_stripped: null,
      description_binary: null,
    };

    expect(toIssue(detail)).toMatchObject({ description_html: "<p>x</p>", label_ids: ["l1"] });
  });
});

describe("toVotes", () => {
  it("drops votes that are not up or down", () => {
    expect(toVotes([{ vote: 0, actor_details: actor }])).toEqual([]);
  });
});
