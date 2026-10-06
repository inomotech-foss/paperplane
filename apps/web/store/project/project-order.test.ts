// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { sortProjectsBySortOrder } from "./project-order";

const project = (name: string, sort_order: number) => ({ name, sort_order });

describe("sortProjectsBySortOrder", () => {
  it("orders by sort_order first", () => {
    const result = sortProjectsBySortOrder([project("A", 3), project("B", 1), project("C", 2)]);
    expect(result.map((p) => p.name)).toEqual(["B", "C", "A"]);
  });

  it("breaks ties by name, ignoring case", () => {
    const result = sortProjectsBySortOrder([
      project("beta", 65535),
      project("Alpha", 65535),
      project("gamma", 65535),
      project("Delta", 65535),
    ]);
    expect(result.map((p) => p.name)).toEqual(["Alpha", "beta", "Delta", "gamma"]);
  });

  it("keeps a lower sort_order ahead of a tied alphabetical group", () => {
    const result = sortProjectsBySortOrder([project("A", 65535), project("Z", 55535), project("B", 65535)]);
    expect(result.map((p) => p.name)).toEqual(["Z", "A", "B"]);
  });
});
