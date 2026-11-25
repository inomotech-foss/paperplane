// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { Hocuspocus } from "@hocuspocus/server";
import RedisClient from "ioredis";
import { WebSocketServer } from "ws";
import * as Y from "yjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getBinaryDataFromDocumentEditorHTMLString } from "@plane/editor/server";
import type { TDocumentPayload } from "@plane/types";
import { ContentEvents } from "@/extensions/content-events";
import { Database } from "@/extensions/database";
import { Redis } from "@/extensions/redis";
import { CONTENT_CHANNEL, applyContentEvent } from "@/lib/content-events";
import { drainCollaborationServer } from "@/lib/drain-server";

const redisState = vi.hoisted(() => {
  const state: { client: RedisClient | null } = { client: null };
  return state;
});
vi.mock("@/redis", () => ({ redisManager: { getClient: () => redisState.client } }));

// Only the API boundary is replaced; the codecs, persistence and Redis sync run unchanged.
const api = vi.hoisted(() => ({ saved: new Map<string, Uint8Array>(), html: new Map<string, string>() }));
vi.mock("@/services/page/handler", () => ({
  getPageService: () => ({
    fetchDescriptionBinary: (id: string) => Promise.resolve(api.saved.get(id) ?? new Uint8Array()),
    fetchDetails: () => Promise.resolve({ name: "" }),
    updateDescriptionBinary: (id: string, payload: TDocumentPayload) => {
      api.saved.set(id, Buffer.from(payload.description_binary!, "base64"));
      api.html.set(id, payload.description_html ?? "");
      return Promise.resolve();
    },
  }),
}));

const portOf = (address: AddressInfo | string | null): number => {
  if (!address || typeof address === "string") throw new Error("Expected a TCP address");
  return address.port;
};

const count = (text: string, part: string) => text.split(part).length - 1;

describe("content events", () => {
  it("ignores a malformed event and a page no one has open", async () => {
    const server = new Hocuspocus({ quiet: true });
    const claim = vi.fn(() => Promise.resolve(true));

    await expect(applyContentEvent(server, "not json", claim)).resolves.toBe(false);
    await expect(applyContentEvent(server, '{"page":"p"}', claim)).resolves.toBe(false);
    await expect(applyContentEvent(server, '{"id":"e","page":"p","html":"<p>x</p>"}', claim)).resolves.toBe(false);
    expect(claim).not.toHaveBeenCalled();
  });

  it("starts without Redis", async () => {
    const extension = new ContentEvents(() => null);
    const server = new Hocuspocus({ quiet: true });

    await expect(
      extension.onConfigure({ instance: server, configuration: server.configuration, version: "" })
    ).resolves.toBeUndefined();
    await extension.onDestroy();
  });
});

const REDIS_URL = process.env.TEST_REDIS_URL;

describe.skipIf(!REDIS_URL)("content events across two live servers", () => {
  const servers: Hocuspocus[] = [];
  const sockets: WebSocketServer[] = [];
  const providers: HocuspocusProvider[] = [];
  const documents: Y.Doc[] = [];
  const extensions: ContentEvents[] = [];
  const urls: string[] = [];
  let publisher: RedisClient;

  const connect = (index: number, name: string) => {
    const document = new Y.Doc();
    documents.push(document);
    const provider = new HocuspocusProvider({ url: urls[index], name, document, token: "test-token" });
    providers.push(provider);
    return { document, provider };
  };

  beforeAll(async () => {
    redisState.client = new RedisClient(`${REDIS_URL}/4`);
    publisher = new RedisClient(`${REDIS_URL}/4`);
    await Promise.all([once(redisState.client, "ready"), once(publisher, "ready")]);
    api.saved.set("open-page", getBinaryDataFromDocumentEditorHTMLString("<p>Old body</p>", "Policy"));

    for (let index = 0; index < 2; index++) {
      const content = new ContentEvents();
      extensions.push(content);
      const server = new Hocuspocus({
        quiet: true,
        onAuthenticate: () =>
          Promise.resolve({
            documentType: "project_page",
            workspaceSlug: "w",
            projectId: "p",
            userId: "u",
            cookie: "c",
          }),
        debounce: 20,
        maxDebounce: 100,
        extensions: [new Redis(), new Database(), content],
      });
      servers.push(server);
      const socket = new WebSocketServer({ host: "127.0.0.1", port: 0 });
      socket.on("connection", (ws, request) => server.handleConnection(ws, request));
      sockets.push(socket);
    }
    await Promise.all(sockets.map((socket) => once(socket, "listening")));
    urls.push(...sockets.map((socket) => `ws://127.0.0.1:${portOf(socket.address())}`));
  });

  afterAll(async () => {
    for (const provider of providers) provider.destroy();
    for (const document of documents) document.destroy();
    try {
      await Promise.all(servers.map((server) => drainCollaborationServer(server, 10_000)));
    } finally {
      await Promise.all(extensions.map((extension) => extension.onDestroy()));
      for (const socket of sockets) for (const client of socket.clients) client.terminate();
      await Promise.all(sockets.map((socket) => new Promise<void>((resolve) => socket.close(() => resolve()))));
      await redisState.client?.flushdb();
      redisState.client?.disconnect();
      publisher.disconnect();
    }
  });

  it("puts a body written through the API into the open page once, and saves it", async () => {
    const first = connect(0, "open-page");
    const second = connect(1, "open-page");
    await vi.waitFor(() => expect(first.provider.isSynced && second.provider.isSynced).toBe(true), {
      timeout: 10_000,
    });
    expect(first.document.getXmlFragment("default").toJSON()).toContain("Old body");

    const html = "<h2>Scope</h2><p>Revised by the API</p>";
    await publisher.publish(CONTENT_CHANNEL, JSON.stringify({ id: "event-1", page: "OPEN-PAGE", html }));

    await vi.waitFor(
      () => {
        for (const { document } of [first, second]) {
          expect(document.getXmlFragment("default").toJSON()).toContain("Revised by the API");
        }
      },
      { timeout: 10_000 }
    );
    await vi.waitFor(() => expect(api.html.get("open-page")).toContain("Revised by the API"), { timeout: 10_000 });

    // both servers hold the page, one applies the body, so it is not inserted twice
    const body = first.document.getXmlFragment("default").toJSON();
    expect(count(body, "Revised by the API")).toBe(1);
    expect(body).not.toContain("Old body");
    expect(second.document.getXmlFragment("default").toJSON()).toBe(body);
    // the title lives in its own fragment and is left alone
    expect(first.document.getXmlFragment("title").toJSON()).toContain("Policy");
  });
});
