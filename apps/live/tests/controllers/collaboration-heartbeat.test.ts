// SPDX-License-Identifier: AGPL-3.0-only

import { EventEmitter } from "node:events";
import type { Hocuspocus } from "@hocuspocus/server";
import type { Request } from "express";
import type WebSocket from "ws";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollaborationController } from "@/controllers/collaboration.controller";

class FakeSocket extends EventEmitter {
  ping = vi.fn();
  terminate = vi.fn();
  close = vi.fn();
}

const connect = () => {
  const ws = new FakeSocket();
  const server = { handleConnection: vi.fn() } as unknown as Hocuspocus;
  new CollaborationController(server).handleConnection(ws as unknown as WebSocket, {} as Request);
  return ws;
};

describe("collaboration heartbeat", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps a socket that answers pings", () => {
    const ws = connect();
    for (let beat = 0; beat < 3; beat++) {
      vi.advanceTimersByTime(30_000);
      ws.emit("pong");
    }
    expect(ws.ping).toHaveBeenCalledTimes(3);
    expect(ws.terminate).not.toHaveBeenCalled();
  });

  it("terminates a socket that stops answering", () => {
    const ws = connect();
    vi.advanceTimersByTime(60_000);
    expect(ws.terminate).toHaveBeenCalledOnce();
  });

  it("stops pinging once the socket is closed", () => {
    const ws = connect();
    ws.emit("close");
    vi.advanceTimersByTime(90_000);
    expect(ws.ping).not.toHaveBeenCalled();
  });
});
