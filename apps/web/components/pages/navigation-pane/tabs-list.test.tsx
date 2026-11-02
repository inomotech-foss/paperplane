// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tabs } from "@makeplane/propel/components/tabs";
import { PageNavigationPaneTabsList } from "./tabs-list";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe("PageNavigationPaneTabsList", () => {
  it("names only the active tab and renders no label element for the others", () => {
    render(
      <Tabs variant="contained" value="info">
        <PageNavigationPaneTabsList activeTab="info" />
      </Tabs>
    );
    const active = screen.getByRole("tab", { name: "page_navigation_pane.tabs.info.label" });
    expect(active.textContent).toBe("page_navigation_pane.tabs.info.label");
    const inactive = screen.getByRole("tab", { name: "page_navigation_pane.tabs.outline.label" });
    expect(inactive.textContent).toBe("");
    expect(inactive.querySelectorAll("span")).toHaveLength(0);
  });
});
