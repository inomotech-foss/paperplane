/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import type { TPageBaselineCandidate } from "@/services/page";
import { baselineRequest, canBaseline, eligibleCount, markQueued, selectedPageIds } from "./page-baseline";

const row = (page: string, skip_reason: TPageBaselineCandidate["skip_reason"]): TPageBaselineCandidate => ({
  page,
  name: page,
  is_locked: skip_reason === "locked",
  skip_reason,
  skip_reason_label: skip_reason ?? "",
  legacy_kind: skip_reason === null || skip_reason === "locked" ? "none" : null,
  legacy_note: "",
});

const pages = [row("a", null), row("b", "locked"), row("c", "archived"), row("d", null)];
const totals = { pages: 4, eligible: 2, locked: 1, skipped: 1, legacy_approved: 0, legacy_other: 0, legacy_none: 2 };

describe("canBaseline", () => {
  it("takes locked pages only when they are included", () => {
    expect(canBaseline(row("b", "locked"), false)).toBe(false);
    expect(canBaseline(row("b", "locked"), true)).toBe(true);
  });

  it("never takes pages with another skip reason", () => {
    expect(canBaseline(row("c", "already_baselined"), true)).toBe(false);
  });
});

describe("eligibleCount", () => {
  it("adds locked pages when they are included", () => {
    expect(eligibleCount(totals, false)).toBe(2);
    expect(eligibleCount(totals, true)).toBe(3);
  });
});

describe("selectedPageIds", () => {
  it("selects every page that can be baselined by default", () => {
    expect(selectedPageIds(pages, false, new Set())).toEqual(["a", "d"]);
    expect(selectedPageIds(pages, true, new Set())).toEqual(["a", "b", "d"]);
  });

  it("leaves out the pages the admin unticked", () => {
    expect(selectedPageIds(pages, true, new Set(["a", "c"]))).toEqual(["b", "d"]);
  });
});

describe("baselineRequest", () => {
  it("sends the chosen pages and options", () => {
    expect(
      baselineRequest({ pageIds: ["a"], includeLocked: true, nextReviewDate: "2027-03-31", comment: "  Migrated " })
    ).toEqual({ page_ids: ["a"], include_locked: true, next_review_date: "2027-03-31", comment: "Migrated" });
  });
});

describe("markQueued", () => {
  it("counts queued pages as baselined so they cannot be queued again", () => {
    const after = markQueued({ pages, totals }, ["a", "b"]);

    expect(after.pages.map((page) => page.skip_reason)).toEqual([
      "already_baselined",
      "already_baselined",
      "archived",
      null,
    ]);
    expect(after.totals).toEqual({
      pages: 4,
      eligible: 1,
      locked: 0,
      skipped: 3,
      legacy_approved: 0,
      legacy_other: 0,
      legacy_none: 1,
    });
    expect(selectedPageIds(after.pages, true, new Set())).toEqual(["d"]);
  });
});
