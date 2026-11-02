// SPDX-License-Identifier: AGPL-3.0-only

import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { WebSocketServer } from "ws";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TimedLoadHocuspocus } from "@/lib/timed-load-hocuspocus";

const LOAD_TIMEOUT_MS = 300;

const portOf = (address: AddressInfo | string | null): number => {
  if (!address || typeof address === "string") throw new Error("Expected a TCP address");
  return address.port;
};

describe("TimedLoadHocuspocus", () => {
  const providers: HocuspocusProvider[] = [];
  let socket: WebSocketServer | undefined;

  afterEach(async () => {
    for (const provider of providers.splice(0)) provider.destroy();
    for (const client of socket?.clients ?? []) client.terminate();
    await new Promise<void>((resolve) => (socket ? socket.close(() => resolve()) : resolve()));
  });

  it("tells waiting clients when a load hangs and loads again for the next client", async () => {
    let loads = 0;
    const server = new TimedLoadHocuspocus(
      {
        quiet: true,
        onAuthenticate: () => Promise.resolve({}),
        extensions: [
          {
            onLoadDocument: () => {
              loads += 1;
              return loads === 1 ? new Promise<never>(() => {}) : Promise.resolve();
            },
          },
        ],
      },
      LOAD_TIMEOUT_MS
    );
    socket = new WebSocketServer({ host: "127.0.0.1", port: 0 });
    socket.on("connection", (ws, request) => server.handleConnection(ws, request));
    await once(socket, "listening");
    const url = `ws://127.0.0.1:${portOf(socket.address())}`;

    const connect = () => {
      const failures: string[] = [];
      const provider = new HocuspocusProvider({
        url,
        name: "page",
        token: "t",
        onAuthenticationFailed: ({ reason }) => failures.push(reason),
      });
      providers.push(provider);
      return { provider, failures };
    };

    const startedAt = Date.now();
    const first = connect();
    const second = connect();
    await vi.waitFor(() => {
      expect(first.failures).toEqual(["document-load-timeout"]);
      expect(second.failures).toEqual(["document-load-timeout"]);
    });
    expect(Date.now() - startedAt).toBeLessThan(LOAD_TIMEOUT_MS + 1000);
    expect(first.provider.isSynced).toBe(false);
    expect(server.loadingDocuments.has("page")).toBe(false);

    const third = connect();
    await vi.waitFor(() => expect(third.provider.isSynced).toBe(true));
    expect(third.failures).toEqual([]);
    expect(loads).toBe(2);
  });
});
