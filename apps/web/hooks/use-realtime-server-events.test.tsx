// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { rootStore as store } from "@/lib/store-context";
import { ProjectPage } from "@/store/pages/project-page";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRealtimeEvent } from "@plane/editor";
import type { EditorRefApi, EventToPayloadMap } from "@plane/editor";
import type { TPage } from "@plane/types";
import { EPageStoreType } from "@/hooks/store";
import type { TCustomEventHandlers } from "@/hooks/use-realtime-page-events";
import { useRealtimePageEvents } from "@/hooks/use-realtime-page-events";
import { useRealtimeServerEvents } from "./use-realtime-server-events";

const pages = vi.hoisted(() => new Map<string, unknown>());
const setToast = vi.hoisted(() => vi.fn());

vi.mock("@plane/blocks/toast", () => ({ setToast }));
vi.mock("@/hooks/store", () => ({
  EPageStoreType: { PROJECT: "PROJECT_PAGE" },
  usePageStore: () => ({ getPageById: (id: string) => pages.get(id), removePage: vi.fn() }),
}));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: "me" } }) }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: vi.fn() }) }));

const pageData = (id: string): TPage => ({
  id,
  name: id,
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
  return { editorRef, emit: (payload: string) => act(() => listeners.forEach((listener) => listener({ payload }))) };
};

const event = <T extends keyof EventToPayloadMap>(action: T, pageId: string, data: EventToPayloadMap[T]) =>
  JSON.stringify(
    createRealtimeEvent({ action, page_id: pageId, descendants_ids: [], data, workspace_slug: "w", user_id: "x" })
  );
const saved = (pageId: string, at: string) =>
  event("property_updated", pageId, { updated_by: "other", updated_at: at });
const childRenamed = (pageId: string, parentId: string, name: string) =>
  JSON.stringify(
    createRealtimeEvent({
      action: "property_updated",
      page_id: pageId,
      parent_id: parentId,
      descendants_ids: [],
      data: { name },
      workspace_slug: "w",
      user_id: "x",
    })
  );
const saveFailed = (pageId: string) =>
  event("error", pageId, { error_message: "<b>forged</b>", error_type: "store", error_code: "content_too_large" });

const setup = (customRealtimeEventHandlers?: TCustomEventHandlers) => {
  const page = new ProjectPage(store, pageData("page-1"));
  const other = new ProjectPage(store, pageData("page-2"));
  pages.set("page-1", page);
  pages.set("page-2", other);
  const first = fakeEditor();
  const hook = renderHook(
    ({ editorRef }: { editorRef: Pick<EditorRefApi, "listenToRealTimeUpdate"> }) => {
      const { updatePageProperties } = useRealtimePageEvents({
        page,
        storeType: EPageStoreType.PROJECT,
        getUserDetails: () => undefined,
        handlers: { fetchEntity: vi.fn(), getRedirectionLink: () => "" },
        customRealtimeEventHandlers,
      });
      useRealtimeServerEvents(editorRef, page.id, updatePageProperties);
    },
    { initialProps: { editorRef: first.editorRef } }
  );
  return { page, other, first, hook };
};

describe("useRealtimeServerEvents", () => {
  afterEach(() => {
    pages.clear();
    setToast.mockClear();
  });

  it("applies a live save of the open page only", () => {
    const { page, other, first } = setup();
    first.emit(saved("page-1", "2026-11-02T10:00:00Z"));
    first.emit(saved("page-2", "2026-11-02T11:00:00Z"));
    first.emit("locked");
    expect(page.updated_by).toBe("other");
    expect(page.updated_at).toBe("2026-11-02T10:00:00Z");
    expect(other.updated_by).toBe("old");
  });

  it("renames a child page of the open page only", () => {
    const { other, first } = setup();
    first.emit(childRenamed("page-2", "page-3", "Elsewhere"));
    expect(other.name).toBe("page-2");
    first.emit(childRenamed("page-2", "page-1", "Renamed child"));
    expect(other.name).toBe("Renamed child");
  });

  it("toasts a failing save once until a save succeeds, without the server's text", () => {
    const banner = vi.fn();
    const { first } = setup({ error: banner });
    first.emit(saveFailed("page-1"));
    first.emit(saveFailed("page-1"));
    expect(setToast).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(setToast.mock.calls)).not.toContain("forged");
    expect(banner).toHaveBeenCalledTimes(2);
    first.emit(saved("page-1", "2026-11-02T10:00:00Z"));
    first.emit(saveFailed("page-1"));
    expect(setToast).toHaveBeenCalledTimes(2);
  });

  it("follows the editor to a new provider", () => {
    const { page, first, hook } = setup();
    const second = fakeEditor();
    hook.rerender({ editorRef: second.editorRef });
    first.emit(saved("page-1", "2026-11-02T10:00:00Z"));
    expect(page.updated_at).toBe("2026-11-01T00:00:00Z");
    second.emit(saved("page-1", "2026-11-02T12:00:00Z"));
    expect(page.updated_at).toBe("2026-11-02T12:00:00Z");
  });
});
