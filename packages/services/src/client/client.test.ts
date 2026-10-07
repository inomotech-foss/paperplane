// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { ApiError, isApiError } from "./api-error";
import { createApiClient, unwrap } from "./client";

type Item = { id: string; name: string };

type TestPaths = {
  "/api/items/{id}/": {
    get: {
      parameters: { path: { id: string } };
      responses: {
        200: { content: { "application/json": Item } };
        404: { content: { "application/json": { error: string } } };
      };
    };
    delete: {
      parameters: { path: { id: string } };
      responses: { 204: { content?: never } };
    };
  };
  "/api/no-slash": {
    get: {
      responses: { 200: { content: { "application/json": Item } } };
    };
  };
};

function setup(response: () => Response, onUnauthorized?: () => void) {
  const requests: Request[] = [];
  const fetch = vi.fn((request: Request) => {
    requests.push(request);
    return Promise.resolve(response());
  });
  const client = createApiClient<TestPaths>("https://api.test", {
    fetch,
    ...(onUnauthorized ? { onUnauthorized } : {}),
  });
  return { client, requests };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("createApiClient", () => {
  it("interpolates path params and sends the session cookie", async () => {
    const { client, requests } = setup(() => json({ id: "1", name: "a" }));
    const item = await unwrap(client.GET("/api/items/{id}/", { params: { path: { id: "1" } } }));
    expectTypeOf(item).toEqualTypeOf<Item>();
    expect(item).toEqual({ id: "1", name: "a" });
    expect(requests[0]?.url).toBe("https://api.test/api/items/1/");
    expect(requests[0]?.credentials).toBe("include");
  });

  it("adds the trailing slash", async () => {
    const { client, requests } = setup(() => json({ id: "1", name: "a" }));
    await unwrap(client.GET("/api/no-slash"));
    expect(requests[0]?.url).toBe("https://api.test/api/no-slash/");
  });

  it("passes per-call headers such as the CSRF token", async () => {
    const { client, requests } = setup(() => json({ id: "1", name: "a" }));
    await unwrap(client.GET("/api/items/{id}/", { params: { path: { id: "1" } }, headers: { "X-CSRFTOKEN": "t" } }));
    expect(requests[0]?.headers.get("X-CSRFTOKEN")).toBe("t");
  });

  it("returns undefined for an empty response", async () => {
    const { client } = setup(() => new Response(null, { status: 204 }));
    const deleted = unwrap(client.DELETE("/api/items/{id}/", { params: { path: { id: "1" } } }));
    expectTypeOf(deleted).resolves.toEqualTypeOf<undefined>();
    await expect(deleted).resolves.toBeUndefined();
  });

  it("throws an ApiError with the status and the parsed body", async () => {
    const { client } = setup(() => json({ error: "missing" }, 404));
    const error: unknown = await unwrap(client.GET("/api/items/{id}/", { params: { path: { id: "1" } } })).catch(
      (e: unknown) => e
    );
    expect(isApiError(error)).toBe(true);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, data: { error: "missing" } });
  });

  it.each([
    ["no Content-Length", () => new Response(null, { status: 502 })],
    ["Content-Length 0", () => new Response(null, { status: 502, headers: { "Content-Length": "0" } })],
  ])("throws an ApiError with undefined data for an empty error body (%s)", async (_, response) => {
    const { client } = setup(response);
    const error: unknown = await unwrap(client.GET("/api/items/{id}/", { params: { path: { id: "1" } } })).catch(
      (e: unknown) => e
    );
    expect(isApiError(error) && error.data).toBeUndefined();
    expect(error).toMatchObject({ status: 502, error: undefined });
  });

  it("calls onUnauthorized on a 401 and still fails the request", async () => {
    const onUnauthorized = vi.fn();
    const { client } = setup(() => json({ detail: "no session" }, 401), onUnauthorized);
    await expect(unwrap(client.GET("/api/items/{id}/", { params: { path: { id: "1" } } }))).rejects.toMatchObject({
      status: 401,
    });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
