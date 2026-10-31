/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import type { TPage } from "@plane/types";
import { orderPages } from "@plane/utils";

const page = (id: string, name: string, sort_order: number): TPage => ({
  id,
  name,
  sort_order,
  access: undefined,
  archived_at: null,
  color: undefined,
  created_at: undefined,
  created_by: null,
  is_favorite: false,
  is_locked: false,
  label_ids: [],
  owned_by: undefined,
  parent: null,
  updated_at: undefined,
  updated_by: null,
  workspace: undefined,
  logo_props: undefined,
});

const pages = [page("c", "Charlie", 300000), page("b2", "bravo", 10), page("a", "Alpha", 5), page("b1", "Bravo", 10)];

describe("orderPages by sort_order", () => {
  it("orders ascending with a lower-cased name tie-break", () => {
    expect(orderPages(pages, "sort_order", "asc").map((p) => p.id)).toEqual(["a", "b2", "b1", "c"]);
  });

  it("reverses the order when descending", () => {
    expect(orderPages(pages, "sort_order", "desc").map((p) => p.id)).toEqual(["c", "b1", "b2", "a"]);
  });
});
