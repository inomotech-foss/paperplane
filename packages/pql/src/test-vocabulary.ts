// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { Vocabulary } from "./vocabulary.js";

export const vocabulary: Vocabulary = {
  fields: [
    {
      name: "priority",
      aliases: [],
      type: "text",
      lookups: ["exact", "in", "isnull", "icontains"],
      operators: ["=", "!=", "~", "in", "not in", "is null", "is not null"],
      choices: ["urgent", "high", "medium", "low", "none"],
    },
    {
      name: "state_id",
      aliases: ["state", "status"],
      type: "uuid",
      lookups: ["exact", "in", "isnull"],
      operators: ["=", "!=", "in", "not in", "is null", "is not null"],
      choices: null,
    },
    {
      name: "assignees__id",
      aliases: ["assignee", "assignees"],
      type: "uuid",
      lookups: ["exact", "in", "isnull"],
      operators: ["=", "!=", "in", "not in", "is null", "is not null"],
      choices: null,
      people: true,
    },
    {
      name: "target_date",
      aliases: ["due_date"],
      type: "date",
      lookups: ["exact", "in", "gt", "gte", "lt", "lte", "isnull"],
      operators: ["=", "!=", ">", ">=", "<", "<=", "in", "not in", "is null", "is not null"],
      choices: null,
    },
  ],
  functions: [
    { name: "childOf", kind: "condition" },
    { name: "currentUser", kind: "value" },
    { name: "descendantOf", kind: "condition" },
    { name: "now", kind: "value" },
  ],
  valuesFor: async (field, prefix) => {
    if (field === "cf")
      return ["Severity", "Amount"].filter((name) => name.toLowerCase().startsWith(prefix.toLowerCase()));
    if (field === "state_id") return ["In Progress", "Done"];
    return [];
  },
};
