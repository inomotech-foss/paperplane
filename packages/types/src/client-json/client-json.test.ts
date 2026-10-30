// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LOGO_PROPS,
  DEFAULT_PROJECT_USER_PREFERENCES,
  DEFAULT_WORKSPACE_VIEW_PROPS,
  parseDisplayFilters,
  parseDisplayProperties,
  parseIssueFilters,
  parseLogoProps,
  parseProjectUserPreferences,
  parseRichFilters,
  parseUserTheme,
  parseWorkspaceViewProps,
  resetClientJsonWarnings,
} from "./index";

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetClientJsonWarnings();
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => warn.mockRestore());

describe("parseClientJson", () => {
  it("logs the first failure of a field once", () => {
    parseLogoProps("garbage");
    parseLogoProps(42);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("falls back quietly for null and empty objects", () => {
    expect(parseLogoProps(null)).toEqual(DEFAULT_LOGO_PROPS);
    expect(parseLogoProps({})).toEqual(DEFAULT_LOGO_PROPS);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("parseLogoProps", () => {
  it("keeps a valid logo", () => {
    const logo = { in_use: "icon", icon: { name: "home", color: "#fff" } };
    expect(parseLogoProps(logo)).toEqual(logo);
  });

  it("drops keys it does not know", () => {
    expect(parseLogoProps({ in_use: "emoji", emoji: { value: "1f600" }, legacy: true })).toEqual({
      in_use: "emoji",
      emoji: { value: "1f600" },
    });
  });

  it("falls back for garbage", () => {
    expect(parseLogoProps({ in_use: "sticker" })).toEqual(DEFAULT_LOGO_PROPS);
  });
});

describe("parseDisplayFilters", () => {
  it("keeps valid display filters", () => {
    const filters = { layout: "kanban", group_by: "state", order_by: "-created_at", calendar: { layout: "week" } };
    expect(parseDisplayFilters(filters)).toEqual(filters);
  });

  it("drops the legacy keys of the backend default", () => {
    const legacy = { type: null, layout: "list", group_by: null, sub_issue: true, calendar_date_range: "" };
    expect(parseDisplayFilters(legacy)).toEqual({ layout: "list", group_by: null, sub_issue: true });
  });

  it("falls back to no display filters for garbage", () => {
    expect(parseDisplayFilters({ layout: "board" })).toEqual({});
    expect(parseDisplayFilters([1, 2])).toEqual({});
  });
});

describe("parseDisplayProperties", () => {
  it("keeps the fixed and the custom property keys", () => {
    const properties = { key: true, labels: false, custom_property_abc: true };
    expect(parseDisplayProperties(properties)).toEqual(properties);
  });

  it("drops unknown keys and non-boolean custom properties", () => {
    expect(parseDisplayProperties({ key: true, colour: true, custom_property_x: "yes" })).toEqual({ key: true });
  });

  it("falls back for garbage", () => {
    expect(parseDisplayProperties({ key: "yes" })).toEqual({});
  });
});

describe("parseIssueFilters", () => {
  it("keeps valid and null filter values", () => {
    expect(parseIssueFilters({ priority: ["high"], state: null })).toEqual({ priority: ["high"], state: null });
  });

  it("falls back for garbage", () => {
    expect(parseIssueFilters({ priority: "high" })).toEqual({});
  });
});

describe("parseRichFilters", () => {
  it("keeps a nested expression", () => {
    const expression = { and: [{ priority__in: "high,urgent" }, { not: { state_group__exact: "completed" } }] };
    expect(parseRichFilters(expression)).toEqual(expression);
  });

  it("keeps custom property conditions and the empty filter", () => {
    expect(parseRichFilters({ customproperty_1__exact: 3 })).toEqual({ customproperty_1__exact: 3 });
    expect(parseRichFilters({})).toEqual({});
  });

  it("falls back to no filter for unknown properties, operators and shapes", () => {
    expect(parseRichFilters({ colour__exact: "red" })).toEqual({});
    expect(parseRichFilters({ priority__near: "high" })).toEqual({});
    expect(parseRichFilters({ or: [] })).toEqual({});
  });
});

describe("parseWorkspaceViewProps", () => {
  it("fills missing parts of legacy view props", () => {
    const legacy = {
      filters: { priority: null },
      display_filters: { layout: "list" },
      display_properties: { key: true },
    };
    expect(parseWorkspaceViewProps(legacy)).toEqual({
      rich_filters: {},
      display_filters: { layout: "list" },
      display_properties: { key: true },
    });
  });

  it("falls back for garbage", () => {
    expect(parseWorkspaceViewProps({ rich_filters: "x" })).toEqual(DEFAULT_WORKSPACE_VIEW_PROPS);
  });
});

describe("parseProjectUserPreferences", () => {
  it("keeps valid preferences and fills missing parts", () => {
    expect(parseProjectUserPreferences({ pages: { block_display: false } })).toEqual({
      pages: { block_display: false },
      navigation: { default_tab: "work_items", hide_in_more_menu: [] },
    });
  });

  it("falls back for garbage", () => {
    expect(parseProjectUserPreferences({ navigation: "pages" })).toEqual(DEFAULT_PROJECT_USER_PREFERENCES);
  });
});

describe("parseUserTheme", () => {
  it("keeps the known keys of a theme", () => {
    expect(parseUserTheme({ theme: "custom", primary: "#000", sidebarText: "#fff" })).toEqual({
      theme: "custom",
      primary: "#000",
    });
  });

  it("falls back for garbage", () => {
    expect(parseUserTheme("dark")).toEqual({});
  });
});
