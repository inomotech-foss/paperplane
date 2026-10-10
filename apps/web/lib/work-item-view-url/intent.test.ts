// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { EIssueLayoutTypes, EIssuesStoreType } from "@plane/types";
import { isPersonalIntent } from "./intent";
import { getWorkItemPage } from "./pages";

const page = getWorkItemPage(EIssuesStoreType.PROJECT);

describe("isPersonalIntent", () => {
  it("is true only for settings the URL never holds", () => {
    expect(isPersonalIntent({ type: "displayFilters", changes: { calendar: { show_weekends: true } } }, page)).toBe(
      true
    );
    expect(isPersonalIntent({ type: "displayFilters", changes: { calendar: { layout: "week" } } }, page)).toBe(false);
    expect(isPersonalIntent({ type: "displayFilters", changes: { layout: EIssueLayoutTypes.KANBAN } }, page)).toBe(
      false
    );
    expect(isPersonalIntent({ type: "displayFilters", changes: { pql: "" } }, page)).toBe(false);
    expect(isPersonalIntent({ type: "displayProperties", changes: { labels: false } }, page)).toBe(false);
    expect(isPersonalIntent({ type: "richFilters", expression: {} }, page)).toBe(false);
  });
});
