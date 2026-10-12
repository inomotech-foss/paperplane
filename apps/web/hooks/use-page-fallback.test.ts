/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import type { CollaborationState } from "@plane/editor";
import type { TDocumentPayload } from "@plane/types";
import { usePageFallback } from "./use-page-fallback";

const seed = vi.hoisted(() => vi.fn((_html: string, _title?: string) => new Uint8Array([1])));

vi.mock("@plane/editor", () => ({
  convertBinaryDataToBase64String: () => "base64",
  getBinaryDataFromDocumentEditorHTMLString: seed,
}));

const AUTO_SAVE_MS = 30_000;

const disconnected: CollaborationState = {
  stage: { kind: "disconnected", error: { type: "max-retries", message: "down" } },
  isServerSynced: false,
  isServerDisconnected: true,
};
const connected: CollaborationState = {
  stage: { kind: "synced" },
  isServerSynced: true,
  isServerDisconnected: false,
};

const httpError = (status: number) =>
  new AxiosError("failed", undefined, undefined, undefined, {
    data: {},
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

const createEditor = () => {
  const state = { isEmpty: true };
  const editor = {
    getDocument: vi.fn(() => ({ binary: new Uint8Array([2]), html: "<p>x</p>", json: {} })),
    isProviderDocumentEmpty: vi.fn(() => state.isEmpty),
    setProviderDocument: vi.fn((_value: Uint8Array) => {
      state.isEmpty = false;
    }),
  };
  return editor;
};

type TSetup = {
  isContentEditable?: boolean;
  fetchPageDescription?: () => Promise<ArrayBuffer>;
  updatePageDescription?: (data: TDocumentPayload) => Promise<void>;
};

const setup = ({
  isContentEditable = true,
  fetchPageDescription = vi.fn(async () => new ArrayBuffer(0)),
  updatePageDescription = vi.fn(async () => {}),
}: TSetup = {}) => {
  const editor = createEditor();
  const editorRef = { current: editor };
  const props = (collaborationState: CollaborationState, html = "<p>x</p>") => ({
    editorRef,
    // Fresh identities on every render, like a re-rendering observer.
    fetchPageDescription: () => fetchPageDescription(),
    updatePageDescription: (data: TDocumentPayload) => updatePageDescription(data),
    collaborationState,
    page: { description_html: html, name: "Page", isContentEditable },
  });
  const hook = renderHook((p: ReturnType<typeof props>) => usePageFallback(p), {
    initialProps: props(disconnected),
  });
  return { editor, fetchPageDescription, updatePageDescription, props, ...hook };
};

const flush = () => act(async () => {});

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  seed.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("usePageFallback", () => {
  it("does not loop when the PATCH is rejected", async () => {
    const updatePageDescription = vi.fn(async (_data: TDocumentPayload): Promise<void> => {
      throw httpError(400);
    });
    const { fetchPageDescription, props, rerender } = setup({ updatePageDescription });
    await flush();

    for (let i = 0; i < 10; i++) {
      rerender(props(disconnected, `<p>${i}</p>`));
    }
    await flush();
    await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_MS * 3));

    expect(fetchPageDescription).toHaveBeenCalledTimes(1);
    expect(updatePageDescription).toHaveBeenCalledTimes(1);
  });

  it("loads a locked page read-only without a PATCH", async () => {
    const { editor, fetchPageDescription, updatePageDescription } = setup({ isContentEditable: false });
    await flush();
    await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_MS));

    expect(fetchPageDescription).toHaveBeenCalled();
    expect(editor.setProviderDocument).toHaveBeenCalledTimes(1);
    expect(updatePageDescription).not.toHaveBeenCalled();
  });

  it("seeds the doc from HTML only once", async () => {
    const { editor, fetchPageDescription } = setup();
    await flush();
    await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_MS * 3));

    expect(fetchPageDescription).toHaveBeenCalledTimes(4);
    expect(seed).toHaveBeenCalledTimes(1);
    expect(editor.setProviderDocument).toHaveBeenCalledTimes(1);
  });

  it("merges a server binary instead of seeding", async () => {
    const { editor } = setup({ fetchPageDescription: vi.fn(async () => new ArrayBuffer(4)) });
    await flush();

    expect(seed).not.toHaveBeenCalled();
    expect(editor.setProviderDocument).toHaveBeenCalledWith(new Uint8Array(4));
  });

  it("never overlaps runs", async () => {
    const fetchPageDescription = vi.fn(() => new Promise<ArrayBuffer>(() => {}));
    setup({ fetchPageDescription });
    await flush();
    await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_MS * 3));

    expect(fetchPageDescription).toHaveBeenCalledTimes(1);
  });

  it("backs off after a server error", async () => {
    const updatePageDescription = vi.fn(async (_data: TDocumentPayload): Promise<void> => {
      throw httpError(503);
    });
    setup({ updatePageDescription });
    await flush();

    await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_MS));
    expect(updatePageDescription).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_MS));
    expect(updatePageDescription).toHaveBeenCalledTimes(2);
  });

  it("recovers when the connection comes back", async () => {
    const updatePageDescription = vi.fn(async (_data: TDocumentPayload): Promise<void> => {
      throw httpError(400);
    });
    const { fetchPageDescription, props, rerender } = setup({ updatePageDescription });
    await flush();

    rerender(props(connected));
    await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_MS * 2));
    expect(fetchPageDescription).toHaveBeenCalledTimes(1);

    updatePageDescription.mockResolvedValue(undefined);
    rerender(props(disconnected));
    await flush();
    await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_MS));

    expect(fetchPageDescription).toHaveBeenCalledTimes(3);
    expect(updatePageDescription).toHaveBeenCalledTimes(3);
  });
});
