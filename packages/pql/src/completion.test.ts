// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";

import { candidatesAt, quote } from "./completion.js";
import type { Vocabulary } from "./vocabulary.js";

const vocabulary: Vocabulary = {
  fields: [
    {
      name: "priority",
      aliases: [],
      type: "text",
      lookups: ["exact", "in", "isnull", "icontains"],
      choices: ["urgent", "high", "medium", "low", "none"],
    },
    { name: "state_id", aliases: ["state", "status"], type: "uuid", lookups: ["exact", "in", "isnull"], choices: null },
    {
      name: "assignees__id",
      aliases: ["assignee", "assignees"],
      type: "uuid",
      lookups: ["exact", "in", "isnull"],
      choices: null,
      people: true,
    },
    {
      name: "target_date",
      aliases: ["due_date"],
      type: "date",
      lookups: ["exact", "in", "gt", "gte", "lt", "lte", "isnull"],
      choices: null,
    },
  ],
  functions: ["childOf", "currentUser", "descendantOf", "now"],
  valuesFor: async (field, prefix) => {
    if (field === "cf")
      return ["Severity", "Amount"].filter((name) => name.toLowerCase().startsWith(prefix.toLowerCase()));
    if (field === "state_id") return ["In Progress", "Done"];
    return [];
  },
};

const labels = async (source: string, caret = source.length) =>
  (await candidatesAt(source, caret, vocabulary)).options.map((option) => option.label);

describe("candidatesAt", () => {
  it("offers fields, not and condition functions at the start", async () => {
    const result = await candidatesAt("", 0, vocabulary);
    expect(result.from).toBe(0);
    expect(result.options.map((o) => o.label)).toEqual([
      "priority",
      "state",
      "status",
      "state_id",
      "assignee",
      "assignees",
      "assignees__id",
      "due_date",
      "target_date",
      "not",
      'cf[""]',
      'childOf("")',
      'descendantOf("")',
    ]);
  });

  it("completes a partial field name from its start", async () => {
    const result = await candidatesAt("pri", 3, vocabulary);
    expect(result.from).toBe(0);
    expect(result.options.map((o) => o.label)).toContain("priority");
  });

  it("offers only the operators the field supports", async () => {
    expect(await labels("priority ")).toEqual(["=", "!=", "~", "in (", "not in (", "is null", "is not null"]);
    expect(await labels("due_date ")).toEqual([
      "=",
      "!=",
      ">",
      ">=",
      "<",
      "<=",
      "in (",
      "not in (",
      "is null",
      "is not null",
    ]);
  });

  it("offers static choices after an operator", async () => {
    expect(await labels("priority = ")).toEqual(["urgent", "high", "medium", "low", "none"]);
  });

  it("offers entity names inside a value list", async () => {
    const result = await candidatesAt("state in (", 10, vocabulary);
    expect(result.options.map((o) => [o.label, o.insert])).toEqual([
      ["In Progress", '"In Progress"'],
      ["Done", '"Done"'],
    ]);
  });

  it("offers currentUser() for people fields", async () => {
    expect(await labels("assignee = ")).toEqual(["currentUser()"]);
  });

  it("offers now() for dates", async () => {
    expect(await labels("due_date < ")).toEqual(["now()", "now() - 7d"]);
  });

  it("starts a new predicate after and", async () => {
    expect(await labels("assignee = currentUser() and ")).toContain("priority");
  });

  it("completes custom property names inside cf[", async () => {
    const result = await candidatesAt('cf["Sev', 7, vocabulary);
    expect(result.from).toBe(3);
    expect(result.options.map((o) => o.insert)).toEqual(['"Severity"']);
  });

  it("completes an unterminated string value from its quote", async () => {
    const result = await candidatesAt('state = "In', 11, vocabulary);
    expect(result.from).toBe(8);
    expect(result.options.map((o) => o.insert)).toEqual(['"In Progress"', '"Done"']);
  });

  it("offers fields after not (", async () => {
    expect(await labels("not (")).toContain("priority");
  });

  it("offers duration examples after now() -", async () => {
    expect(await labels("due_date < now() - ")).toEqual(["1d", "7d", "2w", "12h"]);
  });

  it("offers and/or after a complete predicate", async () => {
    expect(await labels("priority = urgent ")).toEqual(["and", "or"]);
  });

  it("completes is null", async () => {
    expect(await labels("priority is ")).toEqual(["null", "not null"]);
  });

  it("places the caret inside inserted quotes", async () => {
    const result = await candidatesAt("", 0, vocabulary);
    const childOf = result.options.find((o) => o.label === 'childOf("")');
    expect(childOf?.cursor).toBe('childOf("'.length);
  });
});

describe("quote", () => {
  it("escapes backslashes and quotes", () => {
    expect(quote('a "b" \\ c')).toBe('"a \\"b\\" \\\\ c"');
  });
});
