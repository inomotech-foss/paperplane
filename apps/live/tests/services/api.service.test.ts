// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { APIService } from "@/services/api.service";
import type { HttpMethod, RequestOptions } from "@/services/api.service";

vi.mock("@/env", () => ({ env: { API_BASE_URL: "http://unused.test" } }));

type Seen = { method: string | undefined; url: string | undefined; cookie: string | undefined; body: string };

class TestService extends APIService {
  send(method: HttpMethod, path: string, options?: RequestOptions) {
    return this.request(method, path, options);
  }

  sendJson(method: HttpMethod, path: string, options?: RequestOptions) {
    return this.requestJson(method, path, options);
  }
}

let server: Server;
let baseURL = "";
let seen: Seen | undefined;
let handle: (req: IncomingMessage, res: ServerResponse) => void = (_req, res) => res.end();

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString()));
    req.on("end", () => {
      seen = { method: req.method, url: req.url, cookie: req.headers.cookie, body };
      handle(req, res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address: AddressInfo | string | null = server.address();
  if (address === null || typeof address === "string") throw new Error("server has no port");
  baseURL = `http://127.0.0.1:${address.port}/`;
});

afterAll(() => {
  server.close();
});

const json = (status: number, body: unknown) => (_req: IncomingMessage, res: ServerResponse) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

describe("APIService", () => {
  it("adds the trailing slash, the query and the shared headers", async () => {
    handle = json(200, { id: "1" });
    const service = new TestService(baseURL);
    service.setHeader("Cookie", "session=abc");
    const data = await service.sendJson("GET", "/api/pages/1", { query: { mention_type: "user_mention" } });
    expect(data).toEqual({ id: "1" });
    expect(seen).toMatchObject({
      method: "GET",
      url: "/api/pages/1/?mention_type=user_mention",
      cookie: "session=abc",
    });
  });

  it("sends the body as JSON", async () => {
    handle = json(200, {});
    await new TestService(baseURL).send("PATCH", "/api/pages/1/", { body: { name: "Title" } });
    expect(seen).toMatchObject({ method: "PATCH", body: '{"name":"Title"}' });
  });

  it("returns undefined for an empty body", async () => {
    handle = (_req, res) => {
      res.writeHead(204);
      res.end();
    };
    await expect(new TestService(baseURL).sendJson("PATCH", "/api/x/")).resolves.toBeUndefined();
  });

  it("throws an AppError with the status, method, path and body message", async () => {
    handle = json(413, { message: "too large" });
    const error: unknown = await new TestService(baseURL).send("PATCH", "/api/pages/1/description/").catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      message: "too large",
      statusCode: 413,
      method: "PATCH",
      url: "/api/pages/1/description/",
      code: "ERR_BAD_REQUEST",
    });
  });

  it("uses a generic message for a server error without one", async () => {
    handle = json(502, "Bad Gateway");
    await expect(new TestService(baseURL).send("GET", "/api/x/")).rejects.toMatchObject({
      message: "Request failed with status code 502",
      statusCode: 502,
      code: "ERR_BAD_RESPONSE",
    });
  });

  it("returns a redirect instead of following it when asked", async () => {
    handle = (_req, res) => {
      res.writeHead(302, { Location: "https://bucket.test/a.png?sig=1" });
      res.end();
    };
    const response = await new TestService(baseURL).send("GET", "/api/assets/a/?disposition=inline", {
      redirect: "manual",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://bucket.test/a.png?sig=1");
    expect(seen?.url).toBe("/api/assets/a/?disposition=inline");
  });

  it("throws an ABORT_ERROR AppError when the caller aborts", async () => {
    handle = json(200, {});
    const controller = new AbortController();
    controller.abort();
    await expect(
      new TestService(baseURL).send("PATCH", "/api/x/", { signal: controller.signal })
    ).rejects.toMatchObject({ code: "ABORT_ERROR" });
  });

  it("throws an AppError without a status on a network error", async () => {
    const error: unknown = await new TestService("http://127.0.0.1:1").send("GET", "/api/x/").catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ statusCode: undefined, method: "GET", url: "/api/x/" });
  });
});
