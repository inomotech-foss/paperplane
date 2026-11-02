// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { Hocuspocus } from "@hocuspocus/server";
import { WebSocketServer } from "ws";
import * as Y from "yjs";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { recheckAffectedConnections } from "@/lib/access-events";
import { onAuthenticate } from "@/lib/auth";
import { onStateless } from "@/lib/stateless";
import { PAGE, PROJECT, WORKSPACE, startFakeApi } from "../helpers/fake-api";
import type { FakeAccess, FakeApi } from "../helpers/fake-api";

const env = vi.hoisted(() => ({ API_BASE_URL: "http://unused.test" }));
vi.mock("@/env", () => ({ env }));

type Client = {
  provider: HocuspocusProvider;
  document: Y.Doc;
  stateless: string[];
  scopes: string[];
  authFailed: boolean;
};

const body = (document: Y.Doc) => document.getXmlFragment("default").toString();

const write = (document: Y.Doc, text: string) => {
  const paragraph = new Y.XmlElement("paragraph");
  paragraph.insert(0, [new Y.XmlText(text)]);
  document.getXmlFragment("default").push([paragraph]);
};

describe("page access on the collaboration server", () => {
  let api: FakeApi;
  let server: Hocuspocus;
  let socket: WebSocketServer;
  let url = "";
  const clients: Client[] = [];

  const connect = (user: string, access: FakeAccess) => {
    api.users.set(`session=${user}`, { id: user, access });
    const document = new Y.Doc();
    const stateless: string[] = [];
    const scopes: string[] = [];
    const provider = new HocuspocusProvider({
      url,
      name: PAGE,
      document,
      token: JSON.stringify({ id: user, cookie: `session=${user}` }),
      onStateless: ({ payload }) => stateless.push(payload),
      onAuthenticated: ({ scope }) => scopes.push(scope),
      onAuthenticationFailed: () => {
        client.authFailed = true;
      },
      // Like the web client: when the server closes the document, reconnect.
      onClose: () => {
        const webSocket = provider.configuration.websocketProvider.webSocket;
        if (webSocket?.readyState === WebSocket.OPEN) webSocket.close();
      },
    });
    const client: Client = { provider, document, stateless, scopes, authFailed: false };
    clients.push(client);
    return client;
  };

  const synced = async (...connected: Client[]) => {
    await vi.waitFor(() => expect(connected.every((client) => client.provider.isSynced)).toBe(true));
  };

  const connections = () => server.documents.get(PAGE)?.getConnectionsCount() ?? 0;

  const resetRequests = () => {
    api.accessRequests.length = 0;
    api.accessUsers.length = 0;
  };

  const requestsBy = (user: string) => api.accessUsers.filter((id) => id === user).length;

  const serverBody = () => {
    const document = server.documents.get(PAGE);
    if (!document) throw new Error("The page is not loaded");
    return body(document);
  };

  beforeAll(async () => {
    api = await startFakeApi();
    env.API_BASE_URL = api.baseURL;
    server = new Hocuspocus({ quiet: true, onAuthenticate, onStateless });
    socket = new WebSocketServer({ host: "127.0.0.1", port: 0 });
    socket.on("connection", (ws, request) => server.handleConnection(ws, request));
    await once(socket, "listening");
    const address: AddressInfo | string | null = socket.address();
    if (address === null || typeof address === "string") throw new Error("Expected a TCP address");
    const query = new URLSearchParams({ documentType: "project_page", workspaceSlug: WORKSPACE, projectId: PROJECT });
    url = `ws://127.0.0.1:${address.port}/?${query.toString()}`;
  });

  afterEach(async () => {
    for (const client of clients.splice(0)) {
      client.provider.destroy();
      client.document.destroy();
    }
    api.users.clear();
    api.delayMs = 0;
    await vi.waitFor(() => expect(server.documents.has(PAGE)).toBe(false));
  });

  afterAll(async () => {
    for (const client of socket.clients) client.terminate();
    await new Promise<void>((resolve) => socket.close(() => resolve()));
    await api.close();
  });

  it("keeps a user without access out of a document another user has open", async () => {
    const editor = connect("editor", "edit");
    await synced(editor);
    write(editor.document, "secret");
    await vi.waitFor(() => expect(serverBody()).toContain("secret"));

    const outsider = connect("outsider", 403);

    await vi.waitFor(() => expect(outsider.authFailed).toBe(true));
    expect(body(outsider.document)).not.toContain("secret");
    expect(server.documents.get(PAGE)?.getConnectionsCount()).toBe(1);
  });

  it("lets a read-only user see the document but not change it", async () => {
    const editor = connect("editor", "edit");
    await synced(editor);
    write(editor.document, "original");
    const viewer = connect("viewer", "read");
    await synced(viewer);
    await vi.waitFor(() => expect(body(viewer.document)).toContain("original"));

    write(viewer.document, "injected");
    write(editor.document, "later");
    await vi.waitFor(() => expect(body(viewer.document)).toContain("later"));
    await delay(200);

    expect(serverBody()).not.toContain("injected");
    expect(body(editor.document)).not.toContain("injected");
  });

  it("relays page events from editors only", async () => {
    const editor = connect("editor", "edit");
    const viewer = connect("viewer", "read");
    await synced(editor, viewer);

    viewer.provider.sendStateless("archive");
    editor.provider.sendStateless("lock");

    await vi.waitFor(() => expect(viewer.stateless).toContain("locked"));
    expect(editor.stateless).not.toContain("archived");
    expect(viewer.stateless).not.toContain("archived");
  });

  it("re-checks a read-only sender, so an unlock by a now permitted user is relayed and enables writes", async () => {
    const editor = connect("editor", "edit");
    const viewer = connect("viewer", "read");
    await synced(editor, viewer);
    api.users.set("session=viewer", { id: "viewer", access: "edit" });

    viewer.provider.sendStateless("unlock");

    await vi.waitFor(() => expect(editor.stateless).toContain("unlocked"));
    await vi.waitFor(() => expect(viewer.scopes).toEqual(["readonly", "read-write"]), { timeout: 10_000 });
    write(viewer.document, "after unlock");
    await vi.waitFor(() => expect(serverBody()).toContain("after unlock"));
  });

  it("reconnects an editor as read-only after a lock and rejects its writes", async () => {
    const owner = connect("owner", "edit");
    const member = connect("member", "edit");
    await synced(owner, member);
    api.users.set("session=member", { id: "member", access: "read" });
    api.users.set("session=owner", { id: "owner", access: "read" });

    owner.provider.sendStateless("lock");

    await vi.waitFor(() => expect(member.scopes).toEqual(["read-write", "readonly"]), { timeout: 10_000 });
    await vi.waitFor(() => expect(owner.scopes).toEqual(["read-write", "readonly"]), { timeout: 10_000 });
    await synced(member);
    write(member.document, "after lock");
    await delay(200);
    expect(serverBody()).not.toContain("after lock");
  });

  it("keeps editors writable when a re-check gets a 5xx", async () => {
    const owner = connect("owner", "edit");
    const member = connect("member", "edit");
    await synced(owner, member);
    resetRequests();
    api.users.set("session=member", { id: "member", access: 503 });

    owner.provider.sendStateless("lock");

    await vi.waitFor(() => expect(requestsBy("member")).toBe(1));
    await delay(100);
    expect(connections()).toBe(2);
    write(member.document, "still editing");
    await vi.waitFor(() => expect(serverBody()).toContain("still editing"));
    expect(member.scopes).toEqual(["read-write"]);
  });

  it("closes the connection of a user who lost access", async () => {
    const owner = connect("owner", "edit");
    const member = connect("member", "edit");
    await synced(owner, member);
    api.users.set("session=member", { id: "member", access: 403 });

    owner.provider.sendStateless("make-private");

    await vi.waitFor(() => expect(member.authFailed).toBe(true), { timeout: 10_000 });
    write(member.document, "after revoke");
    await delay(200);
    expect(serverBody()).not.toContain("after revoke");
  });

  it("bounds the access checks when clients spam events", async () => {
    const editor = connect("editor", "edit");
    const viewers = [connect("viewer1", "read"), connect("viewer2", "read")];
    await synced(editor, ...viewers);
    resetRequests();
    api.delayMs = 50;

    for (let i = 0; i < 20; i++) editor.provider.sendStateless("lock");
    for (let i = 0; i < 20; i++) viewers[0].provider.sendStateless("archive");
    await delay(600);

    expect(api.accessRequests.length).toBeGreaterThan(0);
    // At most one running and one queued check per document and per connection.
    expect(requestsBy("editor")).toBeLessThanOrEqual(2);
    expect(requestsBy("viewer2")).toBeLessThanOrEqual(2);
    expect(requestsBy("viewer1")).toBeLessThanOrEqual(4);
    expect(editor.stateless).not.toContain("archived");
    expect(connections()).toBe(3);
  });

  it("ignores an access result that a newer check superseded", async () => {
    const editor = connect("editor", "edit");
    const viewer = connect("viewer", "read");
    await synced(editor, viewer);
    resetRequests();
    api.delayMs = 200;
    api.users.set("session=viewer", { id: "viewer", access: "edit" });

    viewer.provider.sendStateless("unarchive");
    await vi.waitFor(() => expect(requestsBy("viewer")).toBe(1));
    api.users.set("session=viewer", { id: "viewer", access: "read" });
    viewer.provider.sendStateless("unarchive");

    await vi.waitFor(() => expect(requestsBy("viewer")).toBe(2));
    await delay(300);
    expect(editor.stateless).not.toContain("unarchived");
    expect(viewer.scopes).toEqual(["readonly"]);
    expect(connections()).toBe(2);
  });

  it("retries instead of failing for good when the API is down at connect", async () => {
    const viewer = connect("viewer", 503);
    await vi.waitFor(() => expect(requestsBy("viewer")).toBeGreaterThan(0));
    api.users.set("session=viewer", { id: "viewer", access: "read" });

    await vi.waitFor(() => expect(viewer.provider.isSynced).toBe(true), { timeout: 10_000 });
    expect(viewer.authFailed).toBe(false);
    expect(viewer.scopes).toEqual(["readonly"]);
  });

  describe("access events from the API", () => {
    const OTHER = "33333333-3333-4333-8333-333333333333";
    const publish = (event: unknown) => recheckAffectedConnections(server.documents, JSON.stringify(event));

    it("closes only the connections of the user named in the event", async () => {
      const editor = connect("editor", "edit");
      const member = connect("member", "edit");
      await synced(editor, member);
      resetRequests();
      api.users.set("session=member", { id: "member", access: 403 });

      await publish({ user: "member" });

      await vi.waitFor(() => expect(member.authFailed).toBe(true), { timeout: 10_000 });
      expect(requestsBy("editor")).toBe(0);
      write(member.document, "after removal");
      await delay(200);
      expect(serverBody()).not.toContain("after removal");
    });

    it("reconnects a demoted user as read-only", async () => {
      const member = connect("member", "edit");
      await synced(member);
      api.users.set("session=member", { id: "member", access: "read" });

      await publish({ project: PROJECT, user: "member" });

      await vi.waitFor(() => expect(member.scopes).toEqual(["read-write", "readonly"]), { timeout: 10_000 });
    });

    it("re-checks every connection to the named page", async () => {
      const editor = connect("editor", "edit");
      const viewer = connect("viewer", "read");
      await synced(editor, viewer);
      resetRequests();

      await publish({ page: PAGE.toUpperCase() });

      expect(requestsBy("editor")).toBe(1);
      expect(requestsBy("viewer")).toBe(1);
      expect(connections()).toBe(2);
    });

    it("limits how many connections it re-checks at once", async () => {
      const editors = [connect("editor1", "edit"), connect("editor2", "edit"), connect("editor3", "edit")];
      await synced(...editors);
      resetRequests();
      api.maxConcurrentAccess = 0;
      api.delayMs = 100;

      await recheckAffectedConnections(server.documents, JSON.stringify({ project: PROJECT }), 2);

      expect(api.accessRequests).toHaveLength(3);
      expect(api.maxConcurrentAccess).toBe(2);
    });

    it.each([{ page: OTHER }, { project: OTHER }, { user: "someone-else" }, { project: PROJECT, user: "nobody" }])(
      "leaves connections outside the scope %j alone",
      async (event) => {
        const editor = connect("editor", "edit");
        await synced(editor);
        resetRequests();

        await publish(event);

        expect(api.accessRequests).toEqual([]);
      }
    );

    it.each(["not json", "null", "[]", "{}", '{"page":5}', '{"page":""}', '{"workspace":"acme"}'])(
      "ignores the malformed message %s",
      async (message) => {
        const editor = connect("editor", "edit");
        await synced(editor);
        resetRequests();

        await recheckAffectedConnections(server.documents, message);

        expect(api.accessRequests).toEqual([]);
        expect(connections()).toBe(1);
      }
    );
  });
});
