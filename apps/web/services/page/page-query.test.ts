// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { toPageQuery } from "./page-query.service";

describe("toPageQuery", () => {
  it("converts the block attributes to the documented query", () => {
    expect(toPageQuery({ kind: "index", scope: "project", sort: "title", reverse: "true", status: "x" })).toEqual({
      kind: "index",
      scope: "project",
      sort: "title",
      reverse: true,
      project_id: undefined,
      root_page_id: undefined,
      depth: undefined,
      limit: undefined,
      search: undefined,
      labels: undefined,
      columns: undefined,
      status: undefined,
    });
  });

  it("drops an unknown scope and rejects an unknown kind", () => {
    expect(toPageQuery({ kind: "recent", scope: "workspace" }).scope).toBeUndefined();
    expect(() => toPageQuery({ kind: "everything" })).toThrow("Unknown page query kind");
  });
});
