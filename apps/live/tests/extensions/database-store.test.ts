// SPDX-License-Identifier: AGPL-3.0-only

import { Hocuspocus } from "@hocuspocus/server";
import type { DirectConnection } from "@hocuspocus/server";
import * as Y from "yjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TDocumentPayload } from "@plane/types";
import { Database } from "@/extensions/database";

vi.mock("@/redis", () => ({ redisManager: { getClient: () => null } }));

const api = vi.hoisted(() => ({
  saved: [] as string[],
  failures: [] as { response: { status: number } }[],
}));
vi.mock("@/services/page/handler", () => ({
  getPageService: () => ({
    fetchDescriptionBinary: () => Promise.resolve(new Uint8Array()),
    fetchDetails: () => Promise.resolve({ name: "" }),
    updateDescriptionBinary: (_id: string, payload: TDocumentPayload) => {
      const failure = api.failures.shift();
      if (failure) return Promise.reject(Object.assign(new Error("save failed"), { isAxiosError: true, ...failure }));
      api.saved.push(payload.description_html!);
      return Promise.resolve();
    },
  }),
}));

const context = { documentType: "project_page", workspaceSlug: "w", projectId: "p", userId: "u", cookie: "c" };

const type = (connection: DirectConnection, text: string) =>
  connection.transact((doc) => {
    const paragraph = new Y.XmlElement("paragraph");
    paragraph.insert(0, [new Y.XmlText(text)]);
    doc.getXmlFragment("default").push([paragraph]);
  });

const openPage = (server: Hocuspocus) => server.openDirectConnection("page", context);

describe("page saves after a failed save", () => {
  afterEach(() => {
    api.saved.length = 0;
    api.failures.length = 0;
  });

  it("retries a save that failed with a server error", async () => {
    const server = new Hocuspocus({ quiet: true, debounce: 20, maxDebounce: 100, extensions: [new Database()] });
    const connection = await openPage(server);
    api.failures.push({ response: { status: 502 } });
    await type(connection, "kept after a 502");
    await connection.disconnect();
    await vi.waitFor(() => expect(api.saved.at(-1)).toContain("kept after a 502"));
    await vi.waitFor(() => expect(server.documents.has("page")).toBe(false));
  });

  it("keeps saving later edits after a rejected save", async () => {
    const server = new Hocuspocus({ quiet: true, debounce: 20, maxDebounce: 100, extensions: [new Database()] });
    const connection = await openPage(server);
    api.failures.push({ response: { status: 403 } });
    await type(connection, "rejected");
    await vi.waitFor(() => expect(api.failures).toHaveLength(0));
    await type(connection, "saved later");
    await connection.disconnect();
    await vi.waitFor(() => expect(api.saved.at(-1)).toContain("saved later"));
    await vi.waitFor(() => expect(server.documents.has("page")).toBe(false));
  });
});
