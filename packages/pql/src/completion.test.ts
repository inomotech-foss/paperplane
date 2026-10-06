// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";

import { candidatesAt, positionAt, quote, subjectAt } from "./completion.js";
import { vocabulary } from "./test-vocabulary.js";

const labels = async (source: string, caret = source.length) =>
  (await candidatesAt(source, caret, vocabulary)).options.map((option) => option.label);
const inserts = async (source: string, caret = source.length) =>
  (await candidatesAt(source, caret, vocabulary)).options.map((option) => option.insert);

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

  it("offers the operators the field declares, in its order", async () => {
    expect(await labels("priority ")).toEqual(["=", "!=", "~", "in", "not in", "is null", "is not null"]);
    expect(await labels("due_date ")).toEqual([
      "=",
      "!=",
      ">",
      ">=",
      "<",
      "<=",
      "in",
      "not in",
      "is null",
      "is not null",
    ]);
    expect(await inserts("priority ")).toContain("in (");
  });

  it("offers every operator the grammar allows on a custom property", async () => {
    expect(await labels('cf["Amount"] ')).toEqual(
      expect.arrayContaining(["=", "!=", ">", "~", "in", "not in", "is null", "is not null"])
    );
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

  it("finds the field across a value list", async () => {
    expect(await labels("state in (a, ")).toEqual(["In Progress", "Done"]);
  });

  it("offers currentUser() for people fields", async () => {
    expect(await labels("assignee = ")).toEqual(["currentUser()"]);
  });

  it("offers now() for dates", async () => {
    expect(await labels("due_date < ")).toEqual(["now()", "now() - 7d"]);
  });

  it("offers nothing field-specific for a custom property value", async () => {
    expect(await labels('cf["p"] in (')).toEqual([]);
  });

  it("starts a new predicate after and", async () => {
    expect(await labels("assignee = currentUser() and ")).toContain("priority");
  });

  it("completes custom property names after the opening quote", async () => {
    const result = await candidatesAt('cf["Sev', 7, vocabulary);
    expect(result.from).toBe(4);
    expect(result.options.map((o) => o.insert)).toEqual(['Severity"']);
  });

  it("completes an unterminated string value after its quote", async () => {
    const result = await candidatesAt('state = "In', 11, vocabulary);
    expect(result.from).toBe(9);
    expect(result.options.map((o) => o.insert)).toEqual(['In Progress"', 'Done"']);
  });

  it("offers fields after not (", async () => {
    expect(await labels("not (")).toContain("priority");
  });

  it("offers duration examples after now() -", async () => {
    expect(await labels("due_date < now() - ")).toEqual(["1d", "7d", "2w", "12h"]);
  });

  it("offers and/or after a complete predicate", async () => {
    expect(await inserts("priority = urgent ")).toEqual(["and ", "or "]);
  });

  it("adds a space when the caret touches a number or duration", async () => {
    expect(await inserts('cf["n"] = 5')).toEqual([" and ", " or "]);
    expect(await inserts("due_date < now() - 7d")).toEqual([" and ", " or "]);
  });

  it("offers nothing inside a string or number", async () => {
    expect(await labels('priority = "urgent"', 14)).toEqual([]);
    expect(await labels('cf["n"] = 125', 11)).toEqual([]);
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

describe("subjectAt", () => {
  it("reads the field or property reference the caret belongs to", () => {
    expect(subjectAt("priority = ", positionAt("priority = ").caretTokenIndex)).toEqual({
      field: "priority",
      property: null,
    });
    expect(subjectAt("state in (a, ", positionAt("state in (a, ").caretTokenIndex)).toEqual({
      field: "state",
      property: null,
    });
    expect(subjectAt('cf["Amount"] > ', positionAt('cf["Amount"] > ').caretTokenIndex)).toEqual({
      field: null,
      property: "Amount",
    });
    expect(subjectAt("priority = urgent and ", positionAt("priority = urgent and ").caretTokenIndex)).toEqual({
      field: null,
      property: null,
    });
  });
});

describe("quote", () => {
  it("escapes backslashes and quotes", () => {
    expect(quote('a "b" \\ c')).toBe('"a \\"b\\" \\\\ c"');
  });
});
