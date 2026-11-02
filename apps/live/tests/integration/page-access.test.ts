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
    const provider = new HocuspocusProvider({
      url,
      name: PAGE,
      document,
      token: JSON.stringify({ id: user, cookie: `session=${user}` }),
      onStateless: ({ payload }) => stateless.push(payload),
      onAuthenticationFailed: () => {
        client.authFailed = true;
      },
    });
    const client: Client = { provider, document, stateless, authFailed: false };
    clients.push(client);
    return client;
  };

  const synced = async (...connected: Client[]) => {
    await vi.waitFor(() => expect(connected.every((client) => client.provider.isSynced)).toBe(true));
  };

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
    write(viewer.document, "after unlock");
    await vi.waitFor(() => expect(serverBody()).toContain("after unlock"));
  });

  it("re-checks the other connections after an access change", async () => {
    const owner = connect("owner", "edit");
    const member = connect("member", "edit");
    await synced(owner, member);
    api.users.set("session=member", { id: "member", access: 403 });

    owner.provider.sendStateless("make-private");

    await vi.waitFor(() => expect(server.documents.get(PAGE)?.getConnectionsCount()).toBe(1));
    write(member.document, "after revoke");
    await delay(200);
    expect(serverBody()).not.toContain("after revoke");
  });
});
