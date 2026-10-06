// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { TWorkItemQueryFields } from "@plane/types";
import { toVocabulary } from "./vocabulary";

const payload: TWorkItemQueryFields = {
  fields: [
    { name: "priority", type: "text", lookups: ["exact", "in"], choices: ["urgent", "high"], aliases: [] },
    { name: "assignees__id", type: "uuid", lookups: ["exact", "in", "isnull"], choices: null, aliases: ["assignee"] },
    { name: "created_by", type: "uuid", lookups: ["exact", "in", "isnull"], choices: null, aliases: [] },
    { name: "target_date", type: "date", lookups: ["exact", "gt", "lt"], choices: null, aliases: ["due_date"] },
  ],
  unsupported: { milestone_id: "milestones are not available" },
  functions: ["childOf", "currentUser", "descendantOf", "now"],
  custom_property_syntax: 'cf["<property id or name>"]',
};

const doneOnly = async () => ["Done"];

describe("toVocabulary", () => {
  it("keeps names, aliases, types, lookups and choices", () => {
    const vocabulary = toVocabulary(payload);
    expect(vocabulary.fields.map((field) => field.name)).toEqual([
      "priority",
      "assignees__id",
      "created_by",
      "target_date",
    ]);
    expect(vocabulary.fields[0]).toMatchObject({ type: "text", lookups: ["exact", "in"], choices: ["urgent", "high"] });
    expect(vocabulary.fields[3]).toMatchObject({ aliases: ["due_date"], type: "date" });
    expect(vocabulary.functions).toEqual(["childOf", "currentUser", "descendantOf", "now"]);
  });

  it("marks member fields as people", () => {
    const people = toVocabulary(payload)
      .fields.filter((field) => field.people)
      .map((field) => field.name);
    expect(people).toEqual(["assignees__id", "created_by"]);
  });

  it("passes the value lookup through", async () => {
    expect(await toVocabulary(payload, doneOnly).valuesFor?.("state_id", "")).toEqual(["Done"]);
  });

  it("is empty before the fields have loaded", () => {
    expect(toVocabulary(undefined)).toEqual({ fields: [], functions: [], valuesFor: undefined });
  });
});
