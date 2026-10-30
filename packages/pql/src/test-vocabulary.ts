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
      planeAliases: ["dueDate", "targetDate"],
      type: "date",
      lookups: ["exact", "in", "gt", "gte", "lt", "lte", "isnull"],
      operators: ["=", "!=", ">", ">=", "<", "<=", "in", "not in", "is null", "is not null"],
      choices: null,
    },
    {
      name: "state__group",
      aliases: ["state_group"],
      planeAliases: ["stateGroup"],
      type: "text",
      lookups: ["exact", "in", "isnull"],
      operators: ["=", "!=", "in", "not in", "is null", "is not null"],
      choices: ["backlog", "unstarted", "started", "completed", "cancelled"],
    },
  ],
  functions: [
    { name: "activeStates", kind: "list", arguments: 0 },
    { name: "childOf", kind: "condition", arguments: 1 },
    { name: "closedStates", kind: "list", arguments: 0 },
    { name: "currentUser", kind: "value", arguments: 0 },
    { name: "daysAgo", kind: "value", arguments: 1 },
    { name: "daysFromNow", kind: "value", arguments: 1 },
    { name: "descendantOf", kind: "condition", arguments: 1 },
    { name: "isOverdue", kind: "condition", arguments: 0 },
    { name: "isTopLevel", kind: "condition", arguments: 0 },
    { name: "now", kind: "value", arguments: 0 },
    { name: "openStates", kind: "list", arguments: 0 },
    { name: "today", kind: "value", arguments: 0 },
  ],
  valuesFor: async (field, prefix) => {
    if (field === "cf")
      return ["Severity", "Amount"].filter((name) => name.toLowerCase().startsWith(prefix.toLowerCase()));
    if (field === "state_id") return ["In Progress", "Done"];
    return [];
  },
};
