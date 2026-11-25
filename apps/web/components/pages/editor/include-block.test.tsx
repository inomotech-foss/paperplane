// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PageIncludeBlock } from "./include-block";

const fetchById = vi.hoisted(() => vi.fn());

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "ws" }) }));
vi.mock("next/link", () => ({
  default: (props: { href: string; children: ReactNode }) => <a href={props.href}>{props.children}</a>,
}));
vi.mock("@/hooks/store/use-workspace", () => ({ useWorkspace: () => ({ getWorkspaceBySlug: () => ({ id: "w1" }) }) }));
vi.mock("@/services/page", () => ({
  ProjectPageService: class {
    fetchById = fetchById;
  },
}));
vi.mock("@/components/editor/document/editor", () => ({
  DocumentEditor: (props: { value: string; editable: boolean }) => (
    <div data-testid="included" data-editable={String(props.editable)}>
      {props.value}
    </div>
  ),
}));

const renderBlock = (props: Partial<Parameters<typeof PageIncludeBlock>[0]> = {}) =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <PageIncludeBlock sourcePageId="snippet" hostPageId="host" projectId="p1" {...props} />
    </SWRConfig>
  );

describe("PageIncludeBlock", () => {
  beforeEach(() => {
    fetchById.mockReset();
  });

  it("shows the source page's content read-only", async () => {
    fetchById.mockResolvedValue({
      id: "snippet",
      name: "snippet.check.highlevel",
      description_html: "<p>Is the implementation still accurate?</p>",
      updated_at: "2026-11-25T00:00:00Z",
    });

    renderBlock();

    const included = await screen.findByTestId("included");
    expect(included.textContent).toBe("<p>Is the implementation still accurate?</p>");
    expect(included.dataset.editable).toBe("false");
    expect(screen.getByText("snippet.check.highlevel").getAttribute("href")).toBe("/ws/projects/p1/pages/snippet");
    expect(fetchById).toHaveBeenCalledWith("ws", "p1", "snippet", false);
  });

  it("does not include a page in itself", () => {
    renderBlock({ sourcePageId: "host" });

    expect(screen.getByText("page_query_block.include.invalid")).toBeTruthy();
    expect(fetchById).not.toHaveBeenCalled();
  });

  it("says so when no page is named", () => {
    renderBlock({ sourcePageId: undefined });

    expect(screen.getByText("page_query_block.include.invalid")).toBeTruthy();
  });

  it("says so when the page cannot be loaded", async () => {
    fetchById.mockRejectedValue(new Error("404"));

    renderBlock();

    expect(await screen.findByText("page_query_block.include.error")).toBeTruthy();
  });
});
