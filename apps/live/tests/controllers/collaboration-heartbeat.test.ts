// SPDX-License-Identifier: AGPL-3.0-only

import { once } from "node:events";
import type { IncomingMessage } from "node:http";
import { Hocuspocus } from "@hocuspocus/server";
import { WebSocket, WebSocketServer } from "ws";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CollaborationController } from "@/controllers/collaboration.controller";

let wss: WebSocketServer;
const clients: WebSocket[] = [];

beforeAll(async () => {
  wss = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await once(wss, "listening");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const client of clients.splice(0)) client.terminate();
});

afterAll(async () => {
  await new Promise<void>((resolve) => wss.close(() => resolve()));
});

const connect = async () => {
  const address = wss.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP address");
  const accepted = new Promise<{ ws: WebSocket; request: IncomingMessage }>((resolve) => {
    wss.once("connection", (ws, request) => resolve({ ws, request }));
  });
  clients.push(new WebSocket(`ws://127.0.0.1:${address.port}`));
  const { ws, request } = await accepted;

  const ping = vi.spyOn(ws, "ping").mockImplementation(() => {});
  const terminate = vi.spyOn(ws, "terminate").mockImplementation(() => {});
  vi.spyOn(ws, "close").mockImplementation(() => {});
  vi.useFakeTimers();
  const server = Object.assign(new Hocuspocus({ quiet: true }), { handleConnection: vi.fn() });
  new CollaborationController(server).handleConnection(ws, request);
  return { ws, ping, terminate };
};

describe("collaboration heartbeat", () => {
  it("keeps a socket that answers pings", async () => {
    const { ws, ping, terminate } = await connect();
    for (let beat = 0; beat < 3; beat++) {
      vi.advanceTimersByTime(30_000);
      ws.emit("pong");
    }
    expect(ping).toHaveBeenCalledTimes(3);
    expect(terminate).not.toHaveBeenCalled();
  });

  it("terminates a socket that stops answering", async () => {
    const { terminate } = await connect();
    vi.advanceTimersByTime(60_000);
    expect(terminate).toHaveBeenCalledOnce();
  });

  it("stops pinging once the socket is closed", async () => {
    const { ws, ping } = await connect();
    ws.emit("close");
    vi.advanceTimersByTime(90_000);
    expect(ping).not.toHaveBeenCalled();
  });
});
