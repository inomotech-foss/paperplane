/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { ThemeProvider } from "next-themes";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HydrateFallback } from "./root";

function Fallback() {
  return (
    <ThemeProvider defaultTheme="system">
      <HydrateFallback />
    </ThemeProvider>
  );
}

describe("HydrateFallback", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("hydrates markup prerendered without the stored theme", async () => {
    vi.stubGlobal("matchMedia", (media: string) => ({
      matches: false,
      media,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Fallback />);
    document.body.appendChild(container);
    localStorage.setItem("theme", "dark");
    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const root = await act(async () => hydrateRoot(container, <Fallback />, { onRecoverableError }));

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    act(() => root.unmount());
    consoleError.mockRestore();
    container.remove();
  });
});
