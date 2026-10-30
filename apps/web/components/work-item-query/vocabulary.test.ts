// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { TWorkItemQueryFields } from "@plane/types";
import { toVocabulary } from "./vocabulary";

const payload: TWorkItemQueryFields = {
  fields: [
    {
      name: "priority",
      type: "text",
      lookups: ["exact", "in"],
      operators: ["=", "!=", "in", "not in"],
      choices: ["urgent", "high"],
      aliases: [],
      plane_aliases: [],
      people: false,
    },
    {
      name: "assignees__id",
      type: "uuid",
      lookups: ["exact", "in", "isnull"],
      operators: ["=", "!=", "in", "not in", "is null", "is not null"],
      choices: null,
      aliases: ["assignee"],
      plane_aliases: [],
      people: true,
    },
    {
      name: "created_by",
      type: "uuid",
      lookups: ["exact", "in", "isnull"],
      operators: ["=", "!=", "in", "not in", "is null", "is not null"],
      choices: null,
      aliases: [],
      plane_aliases: [],
      people: true,
    },
    {
      name: "target_date",
      type: "date",
      lookups: ["exact", "gt", "lt"],
      operators: ["=", "!=", ">", "<"],
      choices: null,
      aliases: ["due_date"],
      plane_aliases: ["dueDate", "targetDate"],
      people: false,
    },
  ],
  unsupported: { milestone_id: "milestones are not available" },
  functions: [
    { name: "childOf", kind: "condition", arguments: 1 },
    { name: "currentUser", kind: "value", arguments: 0 },
    { name: "descendantOf", kind: "condition", arguments: 1 },
    { name: "now", kind: "value", arguments: 0 },
    { name: "openStates", kind: "list", arguments: 0 },
  ],
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
    expect(vocabulary.fields[0]).toMatchObject({
      type: "text",
      operators: ["=", "!=", "in", "not in"],
      choices: ["urgent", "high"],
    });
    expect(vocabulary.fields[3]).toMatchObject({
      aliases: ["due_date"],
      planeAliases: ["dueDate", "targetDate"],
      type: "date",
    });
    expect(vocabulary.functions).toEqual(payload.functions);
  });

  it("takes the people flag from the endpoint", () => {
    const people = toVocabulary(payload)
      .fields.filter((field) => field.people)
      .map((field) => field.name);
    expect(people).toEqual(["assignees__id", "created_by"]);
  });

  it("passes the value lookup through", async () => {
    expect(await toVocabulary(payload, doneOnly).valuesFor?.("state_id", "")).toEqual(["Done"]);
  });

  it("is empty before the fields have loaded", () => {
    expect(toVocabulary(undefined)).toEqual({ fields: [], functions: [], valuesFor: undefined, dialect: "jql" });
  });

  it("carries the dialect completion should use", () => {
    expect(toVocabulary(payload, undefined, "plane").dialect).toBe("plane");
    expect(toVocabulary(payload, undefined, "plane")).not.toEqual(toVocabulary(payload, undefined, "jql"));
  });
});
