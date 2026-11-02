// SPDX-License-Identifier: AGPL-3.0-only

import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { Hocuspocus } from "@hocuspocus/server";
import { WebSocketServer } from "ws";
import * as Y from "yjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Database } from "@/extensions/database";

const LOAD_TIMEOUT_MS = 200;
const LATE_MS = 500;

const api = vi.hoisted(() => {
  const state: { fetches: Array<() => Promise<Uint8Array>> } = { fetches: [] };
  return state;
});
vi.mock("@/redis", () => ({ redisManager: { getClient: () => null } }));
vi.mock("@/services/page/handler", () => ({
  // Ignores the abort signal, like a request whose body never ends
  getPageService: () => ({
    fetchDescriptionBinary: () => api.fetches.shift()?.() ?? Promise.resolve(new Uint8Array()),
  }),
}));

const pageWith = (text: string) => {
  const doc = new Y.Doc();
  doc.getText("t").insert(0, text);
  return Y.encodeStateAsUpdate(doc);
};
const settleLate = (outcome: "resolve" | "reject") => () =>
  new Promise<Uint8Array>((resolve, reject) =>
    setTimeout(() => (outcome === "resolve" ? resolve(pageWith("late")) : reject(new Error("late"))), LATE_MS)
  );

const portOf = (address: AddressInfo | string | null): number => {
  if (!address || typeof address === "string") throw new Error("Expected a TCP address");
  return address.port;
};

describe("page load timeout", () => {
  const providers: HocuspocusProvider[] = [];
  let socket: WebSocketServer | undefined;

  afterEach(async () => {
    for (const provider of providers.splice(0)) provider.destroy();
    for (const client of socket?.clients ?? []) client.terminate();
    await new Promise<void>((resolve) => (socket ? socket.close(() => resolve()) : resolve()));
    api.fetches.length = 0;
  });

  const start = async () => {
    const server = new Hocuspocus({
      quiet: true,
      onAuthenticate: () => Promise.resolve({ documentType: "project_page" }),
      extensions: [new Database({ loadTimeoutMs: LOAD_TIMEOUT_MS })],
    });
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
    return { server, connect };
  };

  it.each(["reject", "resolve"] as const)(
    "fails the load in time and leaves the next load alone when the fetch settles late (%s)",
    async (outcome) => {
      api.fetches.push(settleLate(outcome), () => Promise.resolve(pageWith("fresh")));
      const { server, connect } = await start();

      const startedAt = Date.now();
      const first = connect();
      await vi.waitFor(() => expect(first.failures).toEqual(["document-load-timeout"]));
      expect(Date.now() - startedAt).toBeLessThan(LATE_MS);
      expect(server.loadingDocuments.has("page")).toBe(false);

      const second = connect();
      await vi.waitFor(() => expect(second.provider.isSynced).toBe(true));
      const document = server.documents.get("page");

      await new Promise((resolve) => setTimeout(resolve, LATE_MS));
      expect(server.documents.get("page")).toBe(document);
      expect(document?.getConnectionsCount()).toBe(1);
      expect(second.provider.document.getText("t").toString()).toBe("fresh");
      expect(second.failures).toEqual([]);
    }
  );
});
