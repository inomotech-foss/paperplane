// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, Link, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { useMultipleSelect } from "./use-multiple-select";

const clearSelection = vi.fn();

vi.mock("@/hooks/store/use-multiple-select-store", () => ({
  useMultipleSelectStore: () => ({
    selectedEntityIds: ["i1", "i2"],
    updateSelectedEntityDetails: vi.fn(),
    bulkUpdateSelectedEntityDetails: vi.fn(),
    getActiveEntityDetails: () => null,
    updateActiveEntityDetails: vi.fn(),
    getPreviousActiveEntity: () => null,
    updatePreviousActiveEntity: vi.fn(),
    getNextActiveEntity: () => null,
    updateNextActiveEntity: vi.fn(),
    getLastSelectedEntityDetails: () => null,
    clearSelection,
    getIsEntitySelected: () => true,
    getIsEntityActive: () => false,
    getEntityDetailsFromEntityID: (entityID: string) => ({ entityID, groupID: "g" }),
  }),
}));

const ENTITIES = { g: ["i1", "i2"] };

function List() {
  const containerRef = useRef<HTMLElement | null>(null);
  useMultipleSelect({ containerRef, disabled: false, entities: ENTITIES });
  return <Link to="/other">away</Link>;
}

describe("useMultipleSelect", () => {
  it("leaves without a confirm and clears the selection", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const router = createMemoryRouter(
      [
        { path: "/list", element: <List /> },
        { path: "/other", element: <p>other</p> },
      ],
      { initialEntries: ["/list"] }
    );
    render(<RouterProvider router={router} />);
    clearSelection.mockClear();

    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);

    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: "away" }));
    });

    expect(router.state.location.pathname).toBe("/other");
    expect(confirm).not.toHaveBeenCalled();
    expect(clearSelection).toHaveBeenCalled();
  });
});
