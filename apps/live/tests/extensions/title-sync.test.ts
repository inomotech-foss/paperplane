// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { Document, Hocuspocus } from "@hocuspocus/server";
import * as Y from "yjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BroadcastedEvent } from "@plane/editor";
import { TitleSyncExtension } from "@/extensions/title-sync";
import type { HocusPocusServerContext } from "@/types";

const api = vi.hoisted((): { parent: string | null; savedParent: string | null; saved: string[] } => ({
  parent: "parent-1",
  savedParent: "parent-1",
  saved: [],
}));
const broadcasts = vi.hoisted((): { page: string; event: BroadcastedEvent }[] => []);

vi.mock("@/services/page/handler", () => ({
  getPageService: () => ({
    fetchDetails: () => Promise.resolve({ name: "Child", parent: api.parent }),
    updatePageProperties: (_id: string, { data }: { data: { name: string } }) => {
      api.saved.push(data.name);
      return Promise.resolve({ name: data.name, parent: api.savedParent });
    },
  }),
}));
vi.mock("@/utils/broadcast-message", () => ({
  broadcastMessageToPage: (_instance: unknown, page: string, event: BroadcastedEvent) => {
    broadcasts.push({ page, event });
    return Promise.resolve(true);
  },
}));

const context: HocusPocusServerContext = {
  documentType: "project_page",
  workspaceSlug: "w",
  projectId: "p",
  userId: "u",
  cookie: "c",
};

const rename = (document: Document, title: string) => {
  const fragment = document.getXmlFragment("title");
  document.transact(() => {
    fragment.delete(0, fragment.length);
    const heading = new Y.XmlElement("heading");
    heading.insert(0, [new Y.XmlText(title)]);
    fragment.insert(0, [heading]);
  });
};

const open = async (extension: TitleSyncExtension, name: string) => {
  const instance = new Hocuspocus({ quiet: true });
  const document = new Document(name);
  await extension.onLoadDocument({
    context,
    document,
    documentName: name,
    instance,
    requestHeaders: {},
    requestParameters: new URLSearchParams(),
    socketId: "server",
    connectionConfig: { readOnly: false, isAuthenticated: true },
  });
  await extension.afterLoadDocument({ context, document, documentName: name, instance });
  return document;
};

describe("title sync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    api.parent = "parent-1";
    api.savedParent = "parent-1";
    api.saved.length = 0;
    broadcasts.length = 0;
  });
  afterEach(() => vi.useRealTimers());

  it("tells the parent page about a renamed child", async () => {
    const extension = new TitleSyncExtension();
    const document = await open(extension, "child-1");

    rename(document, "Renamed");

    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0].page).toBe("parent-1");
    expect(broadcasts[0].event.action).toBe("property_updated");
    expect(broadcasts[0].event.affectedPages).toEqual({
      currentPage: "child-1",
      parentPage: "parent-1",
      descendantPages: [],
    });
    expect(broadcasts[0].event.data).toEqual({ name: "Renamed" });
  });

  it("does not broadcast for a root page", async () => {
    api.parent = null;
    const extension = new TitleSyncExtension();
    const document = await open(extension, "root-1");

    rename(document, "Renamed");

    expect(broadcasts).toHaveLength(0);
  });

  it("follows the page to the parent the API reports on save", async () => {
    api.savedParent = "parent-2";
    const extension = new TitleSyncExtension();
    const document = await open(extension, "child-1");

    rename(document, "First");
    await vi.runAllTimersAsync();
    expect(api.saved).toEqual(["First"]);
    rename(document, "Second");

    expect(broadcasts.map(({ page }) => page)).toEqual(["parent-1", "parent-2"]);
  });

  it("forgets the parent when the document unloads", async () => {
    const extension = new TitleSyncExtension();
    const document = await open(extension, "child-1");
    await extension.beforeUnloadDocument({ documentName: "child-1" });
    await extension.afterUnloadDocument({ documentName: "child-1", document });

    rename(document, "After unload");

    expect(broadcasts).toHaveLength(0);
  });
});
