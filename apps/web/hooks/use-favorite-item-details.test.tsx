/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { IFavorite } from "@plane/types";
import { useFavoriteItemDetails } from "./use-favorite-item-details";

vi.mock("@/components/workspace/sidebar/favorites/favorite-items/common", () => ({
  FavoriteItemIcon: () => null,
  generateFavoriteItemLink: () => "/ws/link",
}));
vi.mock("@/hooks/store/use-cycle", () => ({ useCycle: () => ({ getCycleById: () => undefined }) }));
vi.mock("@/hooks/store/use-module", () => ({ useModule: () => ({ getModuleById: () => undefined }) }));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ getProjectById: () => undefined }) }));
vi.mock("@/hooks/store/use-project-view", () => ({ useProjectView: () => ({ getViewById: () => undefined }) }));
vi.mock("@/hooks/store", () => ({ EPageStoreType: { PROJECT: "PROJECT" }, usePage: () => undefined }));
vi.mock("@/hooks/use-additional-favorite-item-details", () => ({
  useAdditionalFavoriteItemDetails: () => ({ getAdditionalFavoriteItemDetails: () => ({}) }),
}));

const favorite: IFavorite = {
  id: "f1",
  name: "Saved",
  entity_type: "view",
  entity_identifier: "v1",
  entity_data: null,
  is_folder: false,
  parent: null,
  project_id: "p1",
  sequence: 1,
  workspace_id: "w1",
};

describe("useFavoriteItemDetails", () => {
  it("renders a favorite whose entity is gone", () => {
    const { result } = renderHook(() => useFavoriteItemDetails("ws", favorite));
    expect(result.current.itemTitle).toBe("Saved");
  });
});
