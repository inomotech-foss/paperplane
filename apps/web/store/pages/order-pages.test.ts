/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import type { TPage } from "@plane/types";
import { orderPages } from "@plane/utils";

const page = (id: string, name: string, sort_order: number) => ({ id, name, sort_order }) as unknown as TPage;

const pages = [page("c", "Charlie", 300000), page("b2", "bravo", 10), page("a", "Alpha", 5), page("b1", "Bravo", 10)];

describe("orderPages by sort_order", () => {
  it("orders ascending with a lower-cased name tie-break", () => {
    expect(orderPages(pages, "sort_order", "asc").map((p) => p.id)).toEqual(["a", "b2", "b1", "c"]);
  });

  it("reverses the order when descending", () => {
    expect(orderPages(pages, "sort_order", "desc").map((p) => p.id)).toEqual(["c", "b1", "b2", "a"]);
  });
});
