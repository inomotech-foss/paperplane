// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { IIssueDisplayProperties, TWorkItemFilterExpression } from "@plane/types";
import { EIssueLayoutTypes } from "@plane/types";
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

  it("formats by calendar layout", () => {
    expect(formatCalendarAnchor("2026-10-05", "month")).toBe("2026-10");
    expect(formatCalendarAnchor("2026-10-05", "week")).toBe("2026-10-05");
  });
});

describe("peek", () => {
  it.each([
    ["INOMO2-123", "INOMO2", 123, "INOMO2-123"],
    ["inomo2-123", "INOMO2", 123, "INOMO2-123"],
    ["WEB-007", "WEB", 7, "WEB-7"],
  ])("parses %s", (raw, projectIdentifier, sequenceId, formatted) => {
    const parsed = peekCodec.parse(raw);
    expect(parsed).toEqual({ value: { projectIdentifier, sequenceId } });
    expect(parsed && peekCodec.format(parsed.value)).toBe(formatted);
  });

  it.each(["INOMO2", "INOMO2-0", "-12", "WEB-1-2", "WEB-x", "WEB 1", "WEB-99999999999999999"])("rejects %j", (raw) =>
    expect(peekCodec.parse(raw)).toBeUndefined()
  );
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
    expect(parseFlagDiff("sub,-empty", all)).toEqual({
      values: { sub_issue: true, show_empty_groups: false },
      invalid: [],
    });
    expect(parseFlagDiff("+tree", all).values).toEqual({ hierarchy: true });
    expect(parseFlagDiff(" tree", all).values).toEqual({ hierarchy: true });
  });

  it("reports unknown and inapplicable entries", () => {
    expect(parseFlagDiff("sub,bogus,tree", ["sub_issue"])).toEqual({
      values: { sub_issue: true },
      invalid: ["bogus", "tree"],
    });
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
    expect(parseDisplayPropertyDiff(`-labels,cp.${CP.toUpperCase()},-cp.${CP}`, { builtIn, custom: true })).toEqual({
      values: { labels: false, [CP_KEY]: false },
      invalid: [],
    });
  });

  it.each([
    ["unknown name", "-bogus", true, ["bogus"]],
    ["inapplicable built-in", "-assignee", true, ["assignee"]],
    ["custom property id that is not a uuid", "cp.123", true, ["cp.123"]],
    ["custom property out of scope", `cp.${CP}`, false, [`cp.${CP}`]],
  ])("reports %s", (_, raw, custom, invalid) => {
    expect(parseDisplayPropertyDiff(raw, { builtIn, custom }).invalid).toEqual(invalid);
  });
});

describe("rich filters", () => {
  const compact: [string, TWorkItemFilterExpression, string][] = [
    ["a condition", { state_id__in: "a,b" }, "state_id:in:a,b"],
    [
      "an AND of conditions",
      { and: [{ priority__in: "urgent,high" }, { name__icontains: "tcu bug" }] },
      "priority:in:urgent,high;name:icontains:tcu bug",
    ],
    ["a negated condition", { not: { state_id__in: "done" } }, "!state_id:in:done"],
    [
      "negated conditions in an AND",
      { and: [{ not: { label_id__in: "x" } }, { target_date__range: "2026-01-01,2026-02-01" }] },
      "!label_id:in:x;target_date:range:2026-01-01,2026-02-01",
    ],
    ["a custom property", { [`customproperty_${CP}__exact`]: "yes" }, `cp.${CP}:exact:yes`],
    ["a single date", { start_date__gt: "2026-10-01" }, "start_date:gt:2026-10-01"],
  ];

  it.each(compact)("writes %s in the compact grammar", (_, expression, expected) => {
    expect(formatRichFilters(expression)).toBe(expected);
    expect(parseRichFilters(expected)).toEqual({ value: expression });
  });

  const fallback: [string, TWorkItemFilterExpression][] = [
    ["a nested AND", { and: [{ and: [{ state_id__in: "a" }, { priority__in: "high" }] }, { label_id__in: "b" }] }],
    ["a NOT group", { not: { and: [{ state_id__in: "a" }, { priority__in: "high" }] } }],
    ["a double negation", { not: { not: { state_id__in: "a" } } }],
    ["a value with ;", { name__icontains: "a;b" }],
    ["a value with :", { name__icontains: "fix: crash" }],
    ["a single value with ,", { name__icontains: "a, b" }],
    ["an empty value", { name__icontains: "" }],
    ["a non-string value", { name__exact: 5 }],
    ["a custom property id that is not a uuid", { customproperty_abc__exact: "x" }],
    ["non-ASCII text", { name__icontains: "Grüße; ✓" }],
  ];

  it.each(fallback)("falls back to JSON for %s", (_, expression) => {
    const encoded = formatRichFilters(expression);
    expect(encoded).toMatch(/^j\.[A-Za-z0-9_-]+$/);
    expect(parseRichFilters(encoded)).toEqual({ value: expression });
  });

  it("writes none for no filters", () => {
    expect(formatRichFilters({})).toBe("none");
    expect(parseRichFilters("none")).toEqual({ value: {} });
  });

  it("unwraps a single AND child", () => {
    expect(formatRichFilters({ and: [{ state_id__in: "a" }] })).toBe("state_id:in:a");
  });

  it.each([
    "state:in:a",
    "state_id:bogus:a",
    "state_id:in:",
    "state_id:in",
    "state_id:in:a:b",
    "state_id:in:a;",
    "name:icontains:a,b",
    "cp.123:exact:x",
    "!!state_id:in:a",
    "",
    "j.",
    "j.!!!",
    json({ and: [] }),
    json({ bogus__in: "a" }),
    json({ state_id__in: "a", priority__in: "b" }),
    json({ state_id__in: ["a"] }),
    json({}),
    "j.e25vdCBqc29u",
  ])("rejects %j", (raw) => expect(parseRichFilters(raw)).toBeUndefined());

  it.each<[string, TWorkItemFilterExpression, TWorkItemFilterExpression, boolean]>([
    ["empty", {}, {}, true],
    [
      "reordered AND",
      { and: [{ state_id__in: "a" }, { priority__in: "high" }] },
      { and: [{ priority__in: "high" }, { state_id__in: "a" }] },
      true,
    ],
    ["single AND child", { and: [{ state_id__in: "a" }] }, { state_id__in: "a" }, true],
    ["different values", { state_id__in: "a" }, { state_id__in: "b" }, false],
    ["negated", { state_id__in: "a" }, { not: { state_id__in: "a" } }, false],
    ["empty vs set", {}, { state_id__in: "a" }, false],
  ])("compares %s", (_, a, b, equal) => {
    expect(richFiltersEqual(a, b)).toBe(equal);
  });
});
