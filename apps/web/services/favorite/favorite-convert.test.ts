// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { ApiSchema } from "@plane/api-types";
import { toFavorite, toFavoriteCreateBody, toFavoriteUpdateBody } from "./favorite-convert";

const row: ApiSchema<"UserFavorite"> = {
  id: "f1",
  entity_type: "page",
  entity_identifier: "e1",
  entity_data: { id: "e1", name: "Doc", logo_props: { in_use: "icon", icon: { name: "x" } }, project_id: "p1" },
  name: null,
  is_folder: false,
  sequence: 2,
  parent: null,
  workspace_id: "w1",
  project_id: "p1",
};

describe("toFavorite", () => {
  it("parses the entity logo and keeps the entity project", () => {
    const favorite = toFavorite(row);
    expect(favorite.entity_data).toEqual({
      id: "e1",
      name: "Doc",
      logo_props: { in_use: "icon", icon: { name: "x" } },
      project_id: "p1",
    });
    expect(favorite.name).toBe("");
    expect("children" in favorite).toBe(false);
  });

  it("keeps a missing entity as null", () => {
    expect(toFavorite({ ...row, entity_data: null }).entity_data).toBeNull();
  });

  it("leaves out the project of a project entity", () => {
    const entity = { id: "p1", name: "P", logo_props: {} };
    expect(toFavorite({ ...row, entity_data: entity }).entity_data).not.toHaveProperty("project_id");
  });
});

describe("favorite bodies", () => {
  it("sends only the fields an update accepts", () => {
    expect(toFavoriteUpdateBody({ ...toFavorite(row), name: "N" })).toEqual({ name: "N", sequence: 2, parent: null });
  });

  it("sends the entity on create", () => {
    expect(toFavoriteCreateBody({ entity_type: "folder", is_folder: true, name: "F", project_id: null })).toEqual({
      entity_type: "folder",
      is_folder: true,
      name: "F",
      project_id: null,
      entity_identifier: undefined,
      parent: undefined,
      sequence: undefined,
    });
  });
});
