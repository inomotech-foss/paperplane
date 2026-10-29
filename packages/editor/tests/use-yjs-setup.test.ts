/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { useYjsSetup } from "@/hooks/use-yjs-setup";
import type { CollaborationState } from "@/types/collaboration";

type TCloseHandler = (event: { event?: { code?: number } }) => void;
type TConfig = { onStateless?: (data: { payload: string }) => void };

const socket = { readyState: WebSocket.OPEN, close: vi.fn() };
const websocketProvider = {
  shouldConnect: true,
  webSocket: socket,
  disconnect: vi.fn(() => {
    websocketProvider.shouldConnect = false;
  }),
  connect: vi.fn(),
};
let config: TConfig = {};
let closeHandler: TCloseHandler | null = null;

vi.mock("@hocuspocus/provider", () => ({
  HocuspocusProvider: class {
    document = new Y.Doc();
    configuration = { websocketProvider };
    constructor(options: TConfig) {
      config = options;
    }
    on(_event: string, handler: TCloseHandler) {
      closeHandler = handler;
    }
    off() {}
    destroy() {}
  },
}));

vi.mock("y-indexeddb", () => ({
  IndexeddbPersistence: class {
    on() {}
    off() {}
    destroy() {}
  },
}));

let states: CollaborationState[] = [];

const Harness = () => {
  useYjsSetup({ docId: "doc", serverUrl: "ws://live", authToken: "t", onStateChange: (state) => states.push(state) });
  return null;
};

const lastStage = () => states[states.length - 1]?.stage;

describe("useYjsSetup server close", () => {
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
    states = [];
    websocketProvider.shouldConnect = true;
    vi.clearAllMocks();
    root = createRoot(document.createElement("div"));
    await act(async () => root.render(createElement(Harness)));
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  it("stops on a forced close announced by the server", () => {
    act(() => {
      config.onStateless?.({
        payload: JSON.stringify({ type: "force_close", code: 4001, reason: "document_too_large" }),
      });
      closeHandler?.({ event: { code: 1000 } });
      // the socket close caused by pausing the provider
      closeHandler?.({ event: { code: 1005 } });
    });

    expect(lastStage()).toEqual({
      kind: "disconnected",
      error: { type: "forced-close", code: 4001, message: "Server forced connection close" },
    });
    expect(websocketProvider.disconnect).toHaveBeenCalled();
  });

  it("reconnects when the server closes the document but not the socket", () => {
    act(() => {
      closeHandler?.({ event: { code: 1000 } });
    });

    expect(socket.close).toHaveBeenCalled();
    expect(websocketProvider.disconnect).not.toHaveBeenCalled();
    expect(lastStage()?.kind).not.toBe("disconnected");
  });

  it("ignores other stateless messages", () => {
    act(() => {
      config.onStateless?.({ payload: "not json" });
      config.onStateless?.({ payload: JSON.stringify({ type: "title" }) });
      closeHandler?.({ event: { code: 1000 } });
    });

    expect(socket.close).toHaveBeenCalled();
    expect(lastStage()?.kind).not.toBe("disconnected");
  });
});
