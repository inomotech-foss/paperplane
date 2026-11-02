/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFocusEmptyTitle } from "./use-focus-empty-title";

const setup = (initial: { name?: string; isEditable?: boolean; isSynced?: boolean; pageId?: string }) => {
  const focus = vi.fn();
  const titleRef = { current: { focus } };
  const hook = renderHook(
    ({ name, isEditable = true, isSynced = false, pageId = "p1" }: typeof initial) =>
      useFocusEmptyTitle({ pageId, name, isEditable, isSynced, titleRef }),
    { initialProps: initial }
  );
  return { focus, ...hook };
};

describe("useFocusEmptyTitle", () => {
  it("focuses the title of an empty editable page once it syncs", () => {
    const { focus, rerender } = setup({ name: "" });
    expect(focus).not.toHaveBeenCalled();

    rerender({ name: "", isSynced: true });
    expect(focus).toHaveBeenCalledWith("end");

    rerender({ name: "", isSynced: true, isEditable: true });
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it("leaves named and read-only pages alone", () => {
    expect(setup({ name: "Roadmap", isSynced: true }).focus).not.toHaveBeenCalled();
    expect(setup({ name: "", isSynced: true, isEditable: false }).focus).not.toHaveBeenCalled();
  });

  it("does not steal focus when the user later clears the title", () => {
    const { focus, rerender } = setup({ name: "Roadmap", isSynced: true });
    rerender({ name: "", isSynced: true });
    expect(focus).not.toHaveBeenCalled();
  });

  it("handles each page on its own", () => {
    const { focus, rerender } = setup({ name: "", isSynced: true, pageId: "p1" });
    rerender({ name: "", isSynced: true, pageId: "p2" });
    expect(focus).toHaveBeenCalledTimes(2);
  });
});
