// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";

import { candidatesAt, positionAt, quote, subjectAt } from "./completion.js";
import { vocabulary } from "./test-vocabulary.js";
import type { Vocabulary } from "./vocabulary.js";

const plane: Vocabulary = { ...vocabulary, dialect: "plane" };
const insertsFor = async (source: string, vocab: Vocabulary) =>
  (await candidatesAt(source, source.length, vocab)).options.map((option) => option.insert);

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
      "state_group",
      "state__group",
      "not",
      'cf[""]',
      'childOf("")',
      'descendantOf("")',
      "isOverdue()",
      "isTopLevel()",
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

  it("offers the date functions for dates", async () => {
    expect(await labels("due_date < ")).toEqual(["daysAgo()", "daysFromNow()", "now()", "now() - 7d", "today()"]);
  });

  it("offers no date function for other fields", async () => {
    expect(await labels("priority = ")).not.toContain("today()");
    expect(await labels("assignee = ")).not.toContain("daysAgo()");
  });

  it("places the caret inside the parentheses of a function with an argument", async () => {
    const result = await candidatesAt("due_date < ", 11, vocabulary);
    expect(result.options.find((o) => o.label === "daysAgo()")?.cursor).toBe("daysAgo(".length);
    expect(result.options.find((o) => o.label === "today()")?.cursor).toBeUndefined();
  });

  it("finds a field by its Plane name without offering Plane names", async () => {
    expect(await labels("dueDate < ")).toContain("today()");
    expect(await labels("DUEDATE < ")).toContain("today()");
    const fields = await labels("");
    expect(fields).toContain("due_date");
    expect(fields).not.toContain("dueDate");
  });

  it("offers conditions with and without arguments, but no list functions", async () => {
    const result = await candidatesAt("", 0, vocabulary);
    const isTopLevel = result.options.find((o) => o.label === "isTopLevel()");
    expect(isTopLevel?.insert).toBe("isTopLevel()");
    expect(isTopLevel?.cursor).toBeUndefined();
    const names = result.options.map((o) => o.label);
    expect(names).toContain("isOverdue()");
    expect(names).not.toContain("openStates()");
    expect(names).not.toContain('openStates("")');
  });

  it("offers Plane field names in the plane dialect", async () => {
    const fields = (await candidatesAt("", 0, plane)).options.map((o) => o.label);
    expect(fields).toEqual(expect.arrayContaining(["dueDate", "targetDate", "stateGroup", "priority", "state"]));
    expect(fields).not.toContain("due_date");
    expect(fields).not.toContain("target_date");
    expect(fields).not.toContain("state_group");
  });

  it("finds a field by any name in the plane dialect", async () => {
    const values = (await candidatesAt("due_date < ", 11, plane)).options.map((o) => o.label);
    expect(values).toContain("today()");
  });

  it("offers list functions after in on the state group field in the plane dialect", async () => {
    const source = "stateGroup in ";
    const options = (await candidatesAt(source, source.length, plane)).options.map((o) => o.label);
    expect(options).toEqual(expect.arrayContaining(["(", "activeStates()", "closedStates()", "openStates()"]));
    const notIn = "stateGroup not in ";
    const negated = (await candidatesAt(notIn, notIn.length, plane)).options.map((o) => o.label);
    expect(negated).toContain("openStates()");
  });

  it("does not offer list functions on other fields", async () => {
    const source = "priority in ";
    const options = (await candidatesAt(source, source.length, plane)).options.map((o) => o.label);
    expect(options).not.toContain("openStates()");
  });

  it("does not offer list functions in the jql dialect", async () => {
    expect(await labels("state_group in ")).not.toContain("openStates()");
  });

  it("leaves room for a list function after in on the state group field in the plane dialect", async () => {
    const stateGroup = await insertsFor("stateGroup ", plane);
    expect(stateGroup).toContain("in ");
    expect(stateGroup).toContain("not in ");
    expect(await insertsFor("priority ", plane)).toContain("in (");
    expect(await insertsFor("state_group ", vocabulary)).toContain("in (");
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
  it("reads the field before an operator is typed", () => {
    expect(subjectAt("priority ", positionAt("priority ").caretTokenIndex)).toEqual({
      field: "priority",
      property: null,
    });
  });

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
