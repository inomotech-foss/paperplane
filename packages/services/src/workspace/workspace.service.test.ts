// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { toWorkspaceSearchResults, workspaceSearchQuery } from "./workspace.service";

describe("toWorkspaceSearchResults", () => {
  it("fills the entity types the response leaves out", () => {
    const project = { id: "p1", name: "P", identifier: "P", workspace__slug: "ws" };
    expect(toWorkspaceSearchResults({ results: { project: [project] } })).toEqual({
      results: { workspace: [], project: [project], issue: [], cycle: [], module: [], issue_view: [], page: [] },
    });
  });
});

describe("workspaceSearchQuery", () => {
  it("sends the workspace flag as the string the API reads", () => {
    expect(workspaceSearchQuery({ search: "a", workspace_search: true })).toEqual({
      search: "a",
      workspace_search: "true",
    });
    expect(workspaceSearchQuery({ search: "a", workspace_search: false, project_id: "p1" }).workspace_search).toBe(
      "false"
    );
  });
});
