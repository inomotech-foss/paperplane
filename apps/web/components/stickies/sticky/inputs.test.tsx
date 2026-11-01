// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StickyInput } from "./inputs";

const sticky = vi.hoisted(() => ({ focusStickyId: "s1" as string | undefined, clearStickyFocus: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: () => "/ws/" }));
vi.mock("@/hooks/store/use-workspace", () => ({ useWorkspace: () => ({ getWorkspaceBySlug: () => undefined }) }));
vi.mock("@/hooks/use-stickies", () => ({ useSticky: () => sticky }));
vi.mock("@/components/editor/sticky-editor", () => ({
  StickyEditor: (props: { autofocus?: boolean }) => (
    <div data-testid="editor" data-autofocus={String(!!props.autofocus)} />
  ),
}));

const renderInput = (stickyId: string) => {
  const props = {
    stickyData: { description_html: "<p></p>" },
    workspaceSlug: "ws",
    handleUpdate: vi.fn(),
    stickyId,
    handleChange: vi.fn(() => Promise.resolve()),
    handleDelete: vi.fn(),
  };
  const view = render(<StickyInput {...props} />);
  return { rerender: () => view.rerender(<StickyInput {...props} />), unmount: view.unmount };
};

describe("StickyInput", () => {
  it("focuses the new sticky once and consumes the request on mount", () => {
    sticky.focusStickyId = "s1";
    const { rerender, unmount } = renderInput("s1");

    expect(screen.getByTestId("editor").dataset.autofocus).toBe("true");
    expect(sticky.clearStickyFocus).toHaveBeenCalledWith("s1");

    sticky.focusStickyId = undefined;
    rerender();
    expect(screen.getByTestId("editor").dataset.autofocus).toBe("true");
    unmount();
  });

  it("does not focus other stickies", () => {
    sticky.focusStickyId = "s1";
    sticky.clearStickyFocus.mockClear();
    renderInput("s2");

    expect(screen.getByTestId("editor").dataset.autofocus).toBe("false");
    expect(sticky.clearStickyFocus).not.toHaveBeenCalled();
  });
});
