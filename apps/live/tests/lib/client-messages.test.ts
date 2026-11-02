// SPDX-License-Identifier: AGPL-3.0-only

import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { Hocuspocus, MessageType } from "@hocuspocus/server";
import { WebSocketServer } from "ws";
import { afterEach, describe, expect, it, vi } from "vitest";
import { beforeHandleMessage, readClientMessageType } from "@/lib/client-messages";
import { onStateless } from "@/lib/stateless";

const ascii = (text: string) => [text.length, ...Array.from(text, (char) => char.charCodeAt(0))];
const frame = (name: string, type: number, payload: string) =>
  new Uint8Array([...ascii(name), type, ...ascii(payload)]);

describe("readClientMessageType", () => {
  it("reads the type after the document name", () => {
    expect(readClientMessageType(frame("page", MessageType.BroadcastStateless, "x"))).toBe(
      MessageType.BroadcastStateless
    );
    expect(readClientMessageType(new Uint8Array([200]))).toBeNull();
  });
});

describe("client stateless messages", () => {
  const cleanup: (() => void)[] = [];
  afterEach(() => cleanup.splice(0).forEach((run) => run()));

  it("relays page actions but not a forged broadcast", async () => {
    const server = new Hocuspocus({
      quiet: true,
      onAuthenticate: () => Promise.resolve({ userId: "u" }),
      beforeHandleMessage,
      onStateless,
    });
    const socket = new WebSocketServer({ host: "127.0.0.1", port: 0 });
    socket.on("connection", (ws, request) => server.handleConnection(ws, request));
    await once(socket, "listening");
    const address: AddressInfo | string | null = socket.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP address");
    cleanup.push(() => socket.close());

    const received: string[] = [];
    const connect = (onStatelessPayload?: (payload: string) => void) => {
      const provider = new HocuspocusProvider({
        url: `ws://127.0.0.1:${address.port}`,
        name: "page",
        token: "t",
        onStateless: ({ payload }) => onStatelessPayload?.(payload),
      });
      cleanup.push(() => provider.destroy());
      return provider;
    };
    const listener = connect((payload) => received.push(payload));
    const sender = connect();
    await vi.waitFor(() => expect(listener.isSynced && sender.isSynced).toBe(true));

    sender.sendStateless("lock");
    await vi.waitFor(() => expect(received).toContain("locked"));

    sender.configuration.websocketProvider.send(frame("page", MessageType.BroadcastStateless, '{"action":"x"}'));
    await new Promise((resolve) => setTimeout(resolve, 100));
    listener.sendStateless("unlock");
    await vi.waitFor(() => expect(received).toContain("unlocked"));
    expect(received).not.toContain('{"action":"x"}');
  });
});
