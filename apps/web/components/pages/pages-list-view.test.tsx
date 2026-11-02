// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EPageStoreType } from "@/hooks/store";
import { WEB_SWR_CONFIG } from "@/lib/swr-config";
import { PagesListView } from "./pages-list-view";

const pages = vi.hoisted(() => ({
  fetchPagesList: vi.fn(),
  createPage: vi.fn(),
  isAnyPageAvailable: false,
  getCurrentProjectPageIdsByTab: () => [],
  getCurrentProjectFilteredPageIdsByTab: () => [],
}));

vi.mock("@/hooks/store", () => ({
  EPageStoreType: { PROJECT: "PROJECT_PAGE" },
  usePageStore: () => pages,
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "ws" }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ currentProjectDetails: { id: "p1" } }) }));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => true }) }));
vi.mock("./header", () => ({ PagesListHeaderRoot: () => null }));
vi.mock("@/components/pages/loaders/page-loader", () => ({ PageLoader: () => <div data-testid="skeleton" /> }));
vi.mock("@plane/blocks/empty-state", () => ({
  EmptyStateDetailed: ({ actions }: { actions?: { label: string; onClick: () => void }[] }) => (
    <div data-testid="empty">
      {actions?.map((action) => (
        <button key={action.label} type="button" onClick={action.onClick}>
          create
        </button>
      ))}
    </div>
  ),
}));

class StatusError extends Error {
  constructor(readonly status: number) {
    super(`status ${status}`);
  }
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ ...WEB_SWR_CONFIG, provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
  );
}

const renderList = () =>
  render(
    <PagesListView pageType="public" projectId="p1" storeType={EPageStoreType.PROJECT} workspaceSlug="ws">
      <span>pages</span>
    </PagesListView>,
    { wrapper: Wrapper }
  );

afterEach(() => {
  vi.clearAllMocks();
});

describe("PagesListView", () => {
  it("loads until the list arrives", async () => {
    pages.fetchPagesList.mockResolvedValueOnce([]);
    renderList();

    expect(screen.getByTestId("skeleton")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("empty")).toBeTruthy());
  });

  it("shows a retry when the list fails to load", async () => {
    pages.fetchPagesList.mockRejectedValueOnce(new StatusError(403));
    renderList();

    const retry = await screen.findByRole("button");
    pages.fetchPagesList.mockResolvedValueOnce([]);
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByTestId("empty")).toBeTruthy());
  });

  it("keeps the list on screen while a page is being created", async () => {
    pages.fetchPagesList.mockResolvedValueOnce([]);
    pages.createPage.mockReturnValueOnce(new Promise(() => {}));
    renderList();
    await waitFor(() => expect(screen.getByTestId("empty")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "create" }));

    expect(pages.createPage).toHaveBeenCalled();
    expect(screen.queryByTestId("skeleton")).toBeNull();
    expect(screen.getByTestId("empty")).toBeTruthy();
  });
});
