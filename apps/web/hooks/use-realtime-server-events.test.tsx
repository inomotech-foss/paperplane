// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { rootStore as store } from "@/lib/store-context";
import { ProjectPage } from "@/store/pages/project-page";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRealtimeEvent } from "@plane/editor";
import type { EditorRefApi } from "@plane/editor";
import type { TPage } from "@plane/types";
import { EPageStoreType } from "@/hooks/store";
import { useRealtimePageEvents } from "@/hooks/use-realtime-page-events";
import { useRealtimeServerEvents } from "./use-realtime-server-events";

const pages = vi.hoisted(() => new Map<string, unknown>());
const update = vi.hoisted(() => vi.fn(async () => ({})));

vi.mock("@/services/page", () => ({
  ProjectPageService: class {
    update = update;
  },
}));
vi.mock("@/hooks/store", () => ({
  EPageStoreType: { PROJECT: "PROJECT_PAGE" },
  usePageStore: () => ({ getPageById: (id: string) => pages.get(id), removePage: vi.fn() }),
}));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: "me" } }) }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: vi.fn() }) }));

const pageData = (id: string, name: string): TPage => ({
  id,
  name,
  access: undefined,
  archived_at: null,
  color: undefined,
  created_at: undefined,
  created_by: null,
  is_favorite: false,
  is_locked: false,
  label_ids: [],
  owned_by: "me",
  parent: null,
  sort_order: 0,
  project_ids: ["p1"],
  updated_at: "2026-11-01T00:00:00Z",
  updated_by: "old",
  workspace: "w1",
  logo_props: undefined,
});

type TListener = (message: { payload: string }) => void;

const fakeEditor = () => {
  const listeners = new Set<TListener>();
  const editorRef: Pick<EditorRefApi, "listenToRealTimeUpdate"> = {
    listenToRealTimeUpdate: () => ({
      on: (_event, callback) => listeners.add(callback),
      off: (_event, callback) => listeners.delete(callback),
    }),
  };
  return { editorRef, emit: (payload: string) => listeners.forEach((listener) => listener({ payload })) };
};

const serverEvent = (pageId: string, data: Record<string, string>) =>
  JSON.stringify(
    createRealtimeEvent({
      action: "property_updated",
      page_id: pageId,
      descendants_ids: [],
      data,
      workspace_slug: "w",
      user_id: "other",
    })
  );

describe("useRealtimeServerEvents", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    pages.clear();
  });

  it("applies a live save and a child title from the server to the page store", async () => {
    store.router.setQuery({ workspaceSlug: "w" });
    const page = new ProjectPage(store, pageData("page-1", "Parent"));
    const child = new ProjectPage(store, pageData("child-1", "Old title"));
    pages.set("page-1", page);
    pages.set("child-1", child);
    const { editorRef, emit } = fakeEditor();

    renderHook(() => {
      const { updatePageProperties } = useRealtimePageEvents({
        page,
        storeType: EPageStoreType.PROJECT,
        getUserDetails: () => undefined,
        handlers: { fetchEntity: vi.fn(), getRedirectionLink: () => "" },
      });
      useRealtimeServerEvents(editorRef, updatePageProperties);
    });

    act(() => {
      emit(serverEvent("page-1", { updated_by: "other", updated_at: "2026-11-02T10:00:00Z" }));
      emit(serverEvent("child-1", { name: "New title" }));
      emit("locked");
    });

    expect(page.updated_by).toBe("other");
    expect(page.updated_at).toBe("2026-11-02T10:00:00Z");
    expect(child.name).toBe("New title");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(update).not.toHaveBeenCalled();
  });
});
