// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
import type { ConnectionConfiguration } from "@hocuspocus/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { onAuthenticate } from "@/lib/auth";
import type { HocusPocusServerContext } from "@/types";
import { PAGE, PROJECT, WORKSPACE, startFakeApi } from "../helpers/fake-api";
import type { FakeAccess, FakeApi, FakeUser } from "../helpers/fake-api";

const env = vi.hoisted(() => ({ API_BASE_URL: "http://unused.test" }));
vi.mock("@/env", () => ({ env }));

let api: FakeApi;

beforeAll(async () => {
  api = await startFakeApi();
  env.API_BASE_URL = api.baseURL;
});

afterAll(async () => {
  await api.close();
});

beforeEach(() => {
  api.users.clear();
  api.accessRequests.length = 0;
});

type Options = { params?: Record<string, string>; documentName?: string; user?: Partial<FakeUser>; tokenId?: string };

const authenticate = (access: FakeAccess, { params = {}, documentName = PAGE, user, tokenId = "u1" }: Options = {}) => {
  api.users.set("session=u1", { id: "u1", access, ...user });
  const connectionConfig: ConnectionConfiguration = { readOnly: false, isAuthenticated: false };
  const context: HocusPocusServerContext = {
    projectId: null,
    cookie: "",
    documentType: "project_page",
    workspaceSlug: null,
    userId: "",
  };
  const requestParameters = new URLSearchParams({
    documentType: "project_page",
    workspaceSlug: WORKSPACE,
    projectId: PROJECT,
    ...params,
  });
  const socket = new Socket();
  const destroy = vi.spyOn(socket, "destroy");
  const result = onAuthenticate({
    requestHeaders: {},
    requestParameters,
    context,
    token: JSON.stringify({ id: tokenId, cookie: "session=u1" }),
    documentName,
    connectionConfig,
    request: new IncomingMessage(socket),
  });
  return { result, connectionConfig, destroy };
};

describe("onAuthenticate page access", () => {
  it("allows writes for edit access", async () => {
    const { result, connectionConfig } = authenticate("edit");

    await expect(result).resolves.toEqual({ user: { id: "u1", name: "u1" } });
    expect(connectionConfig.readOnly).toBe(false);
    expect(api.accessRequests).toEqual([`/api/workspaces/${WORKSPACE}/projects/${PROJECT}/pages/${PAGE}/live-access/`]);
  });

  it("makes the connection read-only for read access", async () => {
    const { result, connectionConfig } = authenticate("read");

    await expect(result).resolves.toBeDefined();
    expect(connectionConfig.readOnly).toBe(true);
  });

  it.each([403, 404])("denies permission when the API answers %i", async (status) => {
    const { result, destroy } = authenticate(status);

    await expect(result).rejects.toThrow("Page access denied");
    expect(destroy).not.toHaveBeenCalled();
  });

  it("denies a page outside the project in the query", async () => {
    const otherProject = "33333333-3333-4333-8333-333333333333";
    const { result, destroy } = authenticate("edit", { params: { projectId: otherProject } });

    await expect(result).rejects.toThrow("Page access denied");
    expect(destroy).not.toHaveBeenCalled();
  });

  it.each([500, 503, "drop", "malformed"] as const)(
    "fails closed and drops the socket when the access check gets %s",
    async (access) => {
      const { result, destroy } = authenticate(access);

      await expect(result).rejects.toThrow("Page access denied");
      expect(destroy).toHaveBeenCalled();
    }
  );

  it("drops the socket when the session check gets a 5xx", async () => {
    const { result, destroy } = authenticate("edit", { user: { me: 502 } });

    await expect(result).rejects.toThrow("Authentication unsuccessful");
    expect(destroy).toHaveBeenCalled();
    expect(api.accessRequests).toEqual([]);
  });

  it.each([
    ["an invalid session", { user: { me: 401 } }],
    ["a token for another user", { tokenId: "u2" }],
  ])("denies permission for %s", async (_label, options) => {
    const { result, destroy } = authenticate("edit", options);

    await expect(result).rejects.toThrow("Authentication unsuccessful");
    expect(destroy).not.toHaveBeenCalled();
  });

  it.each([
    ["a document name that is not a page id", { documentName: "../../users/me" }],
    ["a missing project", { params: { projectId: "" } }],
    ["a malformed workspace slug", { params: { workspaceSlug: "a/b" } }],
  ])("denies %s without calling the access endpoint", async (_label, options) => {
    const { result, destroy } = authenticate("edit", options);

    await expect(result).rejects.toThrow("Page access denied");
    expect(destroy).not.toHaveBeenCalled();
    expect(api.accessRequests).toEqual([]);
  });
});
