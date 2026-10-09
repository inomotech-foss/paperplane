// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { IIssueDisplayProperties, TWorkItemFilterExpression } from "@plane/types";
import { EIssueLayoutTypes, EStartOfTheWeek } from "@plane/types";
import { getComputedDisplayProperties } from "@plane/utils";
import {
  formatCalendarAnchor,
  formatDisplayPropertyDiff,
  formatFlagDiff,
  formatRichFilters,
  groupByCodec,
  layoutCodec,
  orderByCodec,
  parseCalendarAnchor,
  parseDisplayPropertyDiff,
  parseFlagDiff,
  parseRichFilters,
  peekCodec,
  pqlCodec,
  richFiltersEqual,
} from "./codecs";

const CP = "0b5c6a3e-8f1d-4c2a-9e7b-1a2b3c4d5e6f";
const CP_KEY = `custom_property_${CP}` as const;
const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "22222222-2222-4222-8222-222222222222";

const json = (value: unknown) =>
  `j.${btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;

describe("enum codecs", () => {
  it.each([
    [EIssueLayoutTypes.LIST, "list"],
    [EIssueLayoutTypes.KANBAN, "kanban"],
    [EIssueLayoutTypes.CALENDAR, "calendar"],
    [EIssueLayoutTypes.SPREADSHEET, "table"],
    [EIssueLayoutTypes.GANTT, "timeline"],
  ])("layout %s is written as %s and read from both names", (layout, name) => {
    expect(layoutCodec.format(layout)).toBe(name);
    expect(layoutCodec.parse(name)).toEqual({ value: layout });
    expect(layoutCodec.parse(layout)).toEqual({ value: layout });
  });

  it.each([
    ["state_detail.group", "state_group"],
    ["state", "state"],
    ["created_by", "created_by"],
    [null, "none"],
  ] as const)("group by %s is written as %s", (value, name) => {
    expect(groupByCodec.format(value)).toBe(name);
    expect(groupByCodec.parse(name)).toEqual({ value });
  });

  it("accepts the raw state_detail.group value", () => {
    expect(groupByCodec.parse("state_detail.group")).toEqual({ value: "state_detail.group" });
  });

  it.each(["grid", "", "List"])("rejects layout %j", (raw) => expect(layoutCodec.parse(raw)).toBeUndefined());
  it.each(["stage", "", "None"])("rejects group by %j", (raw) => expect(groupByCodec.parse(raw)).toBeUndefined());
  it.each(["-priority", "sort_order", "-sub_issues_count"])("accepts order by %s", (raw) =>
    expect(orderByCodec.parse(raw)).toEqual({ value: raw })
  );
  it.each(["priority_desc", "", "-sort_order"])("rejects order by %j", (raw) =>
    expect(orderByCodec.parse(raw)).toBeUndefined()
  );
});

describe("pql", () => {
  it("only trims", () => {
    const query = 'state = "In Progress" and title ~ "a, b; c:d"';
    expect(pqlCodec.parse(`  ${query}\n`)).toEqual({ value: query });
    expect(pqlCodec.format(` ${query} `)).toBe(query);
  });
});

describe("calendar anchor", () => {
  it.each([
    ["2026-10", "2026-10-01"],
    ["2026-10-05", "2026-10-05"],
    ["2024-02-29", "2024-02-29"],
  ])("parses %s", (raw, anchor) => expect(parseCalendarAnchor(raw)).toEqual({ value: anchor }));

  it.each(["2026-02-30", "2026-13", "2026-00", "26-10", "2026-1-5", "2026-10-05T00:00", ""])("rejects %j", (raw) =>
    expect(parseCalendarAnchor(raw)).toBeUndefined()
  );

  it("writes the month in month layout", () => {
    expect(formatCalendarAnchor("2026-10-05", "month", EStartOfTheWeek.MONDAY)).toBe("2026-10");
  });

  // 2026-10-07 is a Wednesday
  it.each([
    ["2026-10-07", EStartOfTheWeek.SUNDAY, "2026-10-04"],
    ["2026-10-07", EStartOfTheWeek.MONDAY, "2026-10-05"],
    ["2026-10-07", EStartOfTheWeek.WEDNESDAY, "2026-10-07"],
    ["2026-10-07", EStartOfTheWeek.THURSDAY, "2026-10-01"],
    ["2026-10-04", EStartOfTheWeek.MONDAY, "2026-09-28"],
    ["2026-01-01", EStartOfTheWeek.MONDAY, "2025-12-29"],
  ])("writes the week of %s starting on day %s as %s", (anchor, weekStart, expected) => {
    expect(formatCalendarAnchor(anchor, "week", weekStart)).toBe(expected);
  });
});

describe("peek", () => {
  it.each([
    ["INOMO2-123", "INOMO2", 123, "INOMO2-123"],
    ["inomo2-123", "INOMO2", 123, "INOMO2-123"],
    ["WEB-007", "WEB", 7, "WEB-7"],
    ["ABCDEFGHIJKL-1", "ABCDEFGHIJKL", 1, "ABCDEFGHIJKL-1"],
    ["ÇİZ-4", "ÇİZ", 4, "ÇİZ-4"],
  ])("parses %s", (raw, projectIdentifier, sequenceId, formatted) => {
    const parsed = peekCodec.parse(raw);
    expect(parsed).toEqual({ value: { projectIdentifier, sequenceId } });
    expect(parsed && peekCodec.format(parsed.value)).toBe(formatted);
  });

  it.each([
    "INOMO2",
    "INOMO2-0",
    "-12",
    "WEB-1-2",
    "WEB-x",
    "WEB 1",
    "WEB-99999999999999999",
    "ABCDEFGHIJKLM-1",
    "WE.B-1",
    "ÅB-1",
    "WEB-١",
  ])("rejects %j", (raw) => expect(peekCodec.parse(raw)).toBeUndefined());
});

describe("flag diff", () => {
  const all = ["sub_issue", "show_empty_groups", "hierarchy"] as const;

  it.each([
    [{ sub_issue: true }, { sub_issue: false }, "sub"],
    [{ sub_issue: false }, { sub_issue: true }, "-sub"],
    [{ sub_issue: true, show_empty_groups: true, hierarchy: true }, {}, "empty,sub,tree"],
    [{ hierarchy: false, show_empty_groups: true }, { hierarchy: true }, "empty,-tree"],
    [{ sub_issue: true }, { sub_issue: true }, undefined],
  ])("formats %j against %j as %j", (state, baseline, expected) => {
    expect(formatFlagDiff(state, baseline, all)).toBe(expected);
  });

  it("only writes applicable flags", () => {
    expect(formatFlagDiff({ sub_issue: true, hierarchy: true }, {}, ["sub_issue"])).toBe("sub");
  });

  it("reads on and off entries, with + or a decoded space as on", () => {
    expect(parseFlagDiff("sub,-empty")).toEqual({ values: { sub_issue: true, show_empty_groups: false }, invalid: [] });
    expect(parseFlagDiff("+tree").values).toEqual({ hierarchy: true });
    expect(parseFlagDiff(" tree").values).toEqual({ hierarchy: true });
  });

  it.each([
    ["sub,bogus", { sub_issue: true }, ["bogus"]],
    [",", {}, ["", ""]],
    ["", {}, [""]],
    ["sub,", { sub_issue: true }, [""]],
  ])("reports unknown and empty entries in %j", (raw, values, invalid) => {
    expect(parseFlagDiff(raw)).toEqual({ values, invalid });
  });
});

describe("display property diff", () => {
  const builtIn = ["labels", "estimate", "key", "priority"] as const;
  const defaults = getComputedDisplayProperties();

  it.each<[string, IIssueDisplayProperties, IIssueDisplayProperties, boolean, string | undefined]>([
    ["no change", defaults, defaults, true, undefined],
    ["hidden built-ins", { ...defaults, labels: false, estimate: false }, defaults, true, "-estimate,-labels"],
    ["shown custom property", { ...defaults, [CP_KEY]: true }, defaults, true, `cp.${CP}`],
    ["custom property off by default", { ...defaults, [CP_KEY]: false }, defaults, true, undefined],
    [
      "custom property hidden vs a view",
      { ...defaults, [CP_KEY]: false },
      { ...defaults, [CP_KEY]: true },
      true,
      `-cp.${CP}`,
    ],
    ["custom properties out of scope", { ...defaults, labels: false, [CP_KEY]: true }, defaults, false, "-labels"],
    ["inapplicable built-in", { ...defaults, assignee: false }, defaults, true, undefined],
  ])("%s", (_, state, baseline, custom, expected) => {
    expect(formatDisplayPropertyDiff(state, baseline, { builtIn, custom })).toBe(expected);
  });

  it("reads built-ins and custom properties", () => {
    expect(parseDisplayPropertyDiff(`-labels,cp.${CP.toUpperCase()},-cp.${CP}`)).toEqual({
      values: { labels: false, [CP_KEY]: false },
      invalid: [],
    });
  });

  it.each([
    ["unknown name", "-bogus", ["bogus"]],
    ["custom property id that is not a uuid", "cp.123", ["cp.123"]],
    ["empty entry", "labels,,", ["", ""]],
  ])("reports %s", (_, raw, invalid) => {
    expect(parseDisplayPropertyDiff(raw).invalid).toEqual(invalid);
  });
});

describe("rich filters", () => {
  const compact: [string, TWorkItemFilterExpression, string][] = [
    ["a condition", { state_id__in: `${S1},${S2}` }, `state_id:in:${S1},${S2}`],
    [
      "an AND of conditions",
      { and: [{ priority__in: "urgent,high" }, { name__icontains: "tcu bug" }] },
      "priority:in:urgent,high;name:icontains:tcu bug",
    ],
    ["a negated condition", { not: { state_id__in: S1 } }, `!state_id:in:${S1}`],
    [
      "negated conditions in an AND",
      { and: [{ not: { label_id__in: S1 } }, { target_date__range: "2026-01-01,2026-02-01" }] },
      `!label_id:in:${S1};target_date:range:2026-01-01,2026-02-01`,
    ],
    ["a custom property", { [`customproperty_${CP}__exact`]: "yes" }, `cp.${CP}:exact:yes`],
    ["a single date", { start_date__gt: "2026-10-01" }, "start_date:gt:2026-10-01"],
    ["state groups", { state_group__in: "started,completed" }, "state_group:in:started,completed"],
  ];

  it.each(compact)("writes %s in the compact grammar", (_, expression, expected) => {
    expect(formatRichFilters(expression)).toBe(expected);
    expect(parseRichFilters(expected)).toEqual({ value: expression });
  });

  const fallback: [string, TWorkItemFilterExpression][] = [
    ["the deepest AND the API accepts", { and: [{ and: [{ and: [{ and: [{ state_id__in: S1 }] }] }] }] }],
    ["a nested AND", { and: [{ and: [{ state_id__in: S1 }, { priority__in: "high" }] }, { label_id__in: S2 }] }],
    ["a value with ;", { name__icontains: "a;b" }],
    ["a value with :", { name__icontains: "fix: crash" }],
    ["a single value with ,", { name__icontains: "a, b" }],
    ["a number for a custom property", { [`customproperty_${CP}__gt`]: 5 }],
    ["non-ASCII text", { name__icontains: "Grüße; ✓" }],
    ["the deepest tree the API accepts", { and: [{ and: [{ and: [{ not: { state_id__in: S1 } }] }] }] }],
  ];

  it.each(fallback)("falls back to JSON for %s", (_, expression) => {
    const encoded = formatRichFilters(expression);
    expect(encoded).toMatch(/^j\.[A-Za-z0-9_-]+$/);
    expect(parseRichFilters(encoded)).toEqual({ value: expression });
  });

  it.each<[string, TWorkItemFilterExpression]>([
    ["the legacy None value", { assignee_id__in: "None" }],
    ["a label id that is not a uuid", { and: [{ label_id__in: "bug" }, { priority__in: "high" }] }],
    ["an unknown property", { bogus__in: "a" }],
    ["a NOT group", { not: { and: [{ state_id__in: S1 }, { priority__in: "high" }] } }],
  ])("writes nothing it cannot read back for %s", (_, expression) => {
    expect(formatRichFilters(expression)).toBeUndefined();
  });

  it.each<TWorkItemFilterExpression>([
    ...compact.map(([, expression]) => expression),
    ...fallback.map(([, expression]) => expression),
    { [`customproperty_${CP.toUpperCase()}__exact`]: "yes" },
    { and: [{ state_id__in: S1 }] },
    { priority__in: "high, low," },
  ])("reads back what it writes for %j", (expression) => {
    const encoded = formatRichFilters(expression);
    expect(encoded).toBeDefined();
    const parsed = parseRichFilters(encoded ?? "");
    expect(parsed && richFiltersEqual(parsed.value, expression)).toBe(true);
  });

  it.each([{}, null, undefined])("writes none for %j", (expression) => {
    expect(formatRichFilters(expression)).toBe("none");
  });

  it("reads none as no filters", () => {
    expect(parseRichFilters("none")).toEqual({ value: {} });
  });

  it("unwraps a single AND child", () => {
    expect(formatRichFilters({ and: [{ state_id__in: S1 }] })).toBe(`state_id:in:${S1}`);
  });

  it.each([
    [`state_id:in:${S1}, ${S2}`, `${S1},${S2}`],
    [`state_id:in:${S1},,${S2}`, `${S1},${S2}`],
    [`state_id:in:${S1},`, S1],
    ["target_date:range: 2026-01-01 , 2026-02-01", "2026-01-01,2026-02-01"],
  ])("canonicalizes the list in %j", (raw, value) => {
    const [property, operator] = raw.split(":");
    expect(parseRichFilters(raw)).toEqual({ value: { [`${property}__${operator}`]: value } });
  });

  it("canonicalizes lists in the store state", () => {
    expect(formatRichFilters({ priority__in: "high, low," })).toBe("priority:in:high,low");
  });

  it.each([
    ["an unknown property", "state:in:x"],
    ["an unknown operator", `state_id:bogus:${S1}`],
    ["an empty value", "state_id:in:"],
    ["a whitespace value", "name:icontains:   "],
    ["a missing value", "state_id:in"],
    ["a colon in the value", "name:icontains:a:b"],
    ["an empty item", `state_id:in:${S1};`],
    ["a comma in a single value", "name:icontains:a,b"],
    ["a custom property id that is not a uuid", "cp.123:exact:x"],
    ["a double negation", `!!state_id:in:${S1}`],
    ["gt on priority", "priority:gt:high"],
    ["in on name", "name:in:a,b"],
    ["range on state", `state_id:range:${S1},${S2}`],
    ["an invalid range", "target_date:range:2026-13-45,banana"],
    ["a one-sided range", "target_date:range:2026-01-01"],
    ["a three-sided range", "target_date:range:2026-01-01,2026-01-02,2026-01-03"],
    ["an invalid date", "start_date:gt:2026-02-30"],
    ["a state id that is not a uuid", "state_id:in:done"],
    ["an unknown priority", "priority:in:critical"],
    ["an unknown state group", "state_group:exact:doing"],
    ["icontains on a date", "start_date:icontains:2026"],
    ["nothing", ""],
    ["an empty JSON payload", "j."],
    ["invalid base64", "j.!!!"],
    ["invalid JSON", "j.e25vdCBqc29u"],
    ["an empty AND", json({ and: [] })],
    ["an OR", json({ or: [{ state_id__in: S1 }] })],
    ["an unknown JSON property", json({ bogus__in: "a" })],
    ["two conditions in one leaf", json({ state_id__in: S1, priority__in: "high" })],
    ["a list value", json({ state_id__in: [S1] })],
    ["empty JSON", json({})],
    ["a custom property in JSON that is not a uuid", json({ customproperty_abc__exact: "x" })],
    ["an empty value in JSON", json({ name__icontains: "" })],
    ["a number for a built-in", json({ name__icontains: 5 })],
    ["a NOT group", json({ not: { and: [{ state_id__in: S1 }, { priority__in: "high" }] } })],
    ["a double negation in JSON", json({ not: { not: { state_id__in: S1 } } })],
    [
      "a tree deeper than the API allows",
      json({ and: [{ and: [{ and: [{ and: [{ and: [{ state_id__in: S1 }] }] }] }] }] }),
    ],
    [
      "a negation deeper than the API allows",
      json({ and: [{ and: [{ and: [{ and: [{ not: { state_id__in: S1 } }] }] }] }] }),
    ],
  ])("rejects %s", (_, raw) => expect(parseRichFilters(raw)).toBeUndefined());

  it.each<
    [string, TWorkItemFilterExpression | null | undefined, TWorkItemFilterExpression | null | undefined, boolean]
  >([
    ["empty", {}, {}, true],
    ["null and empty", null, {}, true],
    ["undefined and empty", undefined, {}, true],
    [
      "reordered AND",
      { and: [{ state_id__in: S1 }, { priority__in: "high" }] },
      { and: [{ priority__in: "high" }, { state_id__in: S1 }] },
      true,
    ],
    ["single AND child", { and: [{ state_id__in: S1 }] }, { state_id__in: S1 }, true],
    ["different values", { state_id__in: S1 }, { state_id__in: S2 }, false],
    ["negated", { state_id__in: S1 }, { not: { state_id__in: S1 } }, false],
    ["empty vs set", {}, { state_id__in: S1 }, false],
  ])("compares %s", (_, a, b, equal) => {
    expect(richFiltersEqual(a, b)).toBe(equal);
  });
});
