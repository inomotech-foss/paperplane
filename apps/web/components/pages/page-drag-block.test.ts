/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { getPageDragBlock } from "./page-drag-block";

const movable = { archived_at: null, canCurrentUserMovePage: true };

describe("getPageDragBlock", () => {
  it("lets a movable page be dragged", () => {
    expect(getPageDragBlock(movable, false)).toBeUndefined();
  });

  it("blocks archived pages first", () => {
    expect(getPageDragBlock({ archived_at: "2026-10-12", canCurrentUserMovePage: false }, true)).toBe("archived");
  });

  it("blocks pages the user cannot move", () => {
    expect(getPageDragBlock({ ...movable, canCurrentUserMovePage: false }, true)).toBe("no_permission");
    expect(getPageDragBlock(undefined, false)).toBe("no_permission");
  });

  it("blocks dragging while the list is filtered", () => {
    expect(getPageDragBlock(movable, true)).toBe("filtered");
  });
});
