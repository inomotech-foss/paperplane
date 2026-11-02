// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ConnectionConfiguration } from "@hocuspocus/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { onAuthenticate } from "@/lib/auth";
import type { HocusPocusServerContext } from "@/types";
import { PAGE, PROJECT, WORKSPACE, startFakeApi } from "../helpers/fake-api";
import type { FakeAccess, FakeApi } from "../helpers/fake-api";

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

const authenticate = (access: FakeAccess, params: Record<string, string> = {}, documentName = PAGE) => {
  api.users.set("session=u1", { id: "u1", access });
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
  const result = onAuthenticate({
    requestHeaders: {},
    requestParameters,
    context,
    token: JSON.stringify({ id: "u1", cookie: "session=u1" }),
    documentName,
    connectionConfig,
  });
  return { result, connectionConfig };
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

  it.each([403, 404])("rejects when the API answers %i", async (status) => {
    await expect(authenticate(status).result).rejects.toThrow("Page access denied");
  });

  it("rejects a page outside the project in the query", async () => {
    const otherProject = "33333333-3333-4333-8333-333333333333";
    await expect(authenticate("edit", { projectId: otherProject }).result).rejects.toThrow("Page access denied");
  });

  it.each([500, 502])("fails closed when the API answers %i", async (status) => {
    await expect(authenticate(status).result).rejects.toThrow("Page access denied");
  });

  it.each(["drop", "malformed"] as const)("fails closed when the access response is %s", async (access) => {
    await expect(authenticate(access).result).rejects.toThrow("Page access denied");
  });

  it.each([
    ["a document name that is not a page id", {}, "../../users/me"],
    ["a missing project", { projectId: "" }, PAGE],
    ["a malformed workspace slug", { workspaceSlug: "a/b" }, PAGE],
  ])("rejects %s without calling the access endpoint", async (_label, params, documentName) => {
    await expect(authenticate("edit", params, documentName).result).rejects.toThrow("Page access denied");
    expect(api.accessRequests).toEqual([]);
  });
});
