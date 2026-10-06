/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ResizableSidebar } from "./resizable-sidebar";

const platform = vi.hoisted(() => ({ isMobile: false }));

vi.mock("@plane/hooks", () => ({ usePlatformOS: () => platform }));

function renderSidebar() {
  return render(
    <ResizableSidebar togglePeek={vi.fn()} toggleCollapsed={vi.fn()} width={250} setWidth={vi.fn()}>
      <div />
    </ResizableSidebar>
  ).container.querySelector("#main-sidebar");
}

describe("ResizableSidebar", () => {
  beforeEach(() => {
    platform.isMobile = false;
  });

  it("does not mark the sidebar as outside-click protected on desktop", () => {
    expect(renderSidebar()?.hasAttribute("data-prevent-outside-click")).toBe(false);
  });

  it("marks the sidebar as outside-click protected on mobile", () => {
    platform.isMobile = true;
    expect(renderSidebar()?.hasAttribute("data-prevent-outside-click")).toBe(true);
  });
});
