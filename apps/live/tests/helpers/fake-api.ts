// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

export const WORKSPACE = "acme";
export const PROJECT = "11111111-1111-4111-8111-111111111111";
export const PAGE = "22222222-2222-4222-8222-222222222222";

/** An access level, an HTTP status, a body the API never sends, or a dropped connection. */
export type FakeAccess = "edit" | "read" | number | "malformed" | "drop";

/** A user known to the fake API, keyed by the cookie they send. */
export type FakeUser = { id: string; access: FakeAccess };

export type FakeApi = {
  baseURL: string;
  users: Map<string, FakeUser>;
  accessRequests: string[];
  close: () => Promise<void>;
};

const LIVE_ACCESS = /^\/api\/workspaces\/([^/]+)\/projects\/([^/]+)\/pages\/([^/]+)\/live-access\/$/;

/** Answers `users/me` and the page live-access endpoint the way the API does for each cookie. */
export const startFakeApi = async (): Promise<FakeApi> => {
  const users = new Map<string, FakeUser>();
  const accessRequests: string[] = [];
  const server: Server = createServer((req, res) => {
    const user = users.get(req.headers.cookie ?? "");
    const reply = (status: number, body: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (!user) return reply(401, { error: "Authentication credentials were not provided." });
    if (req.url === "/api/users/me/") return reply(200, { id: user.id, display_name: user.id });
    const match = LIVE_ACCESS.exec(req.url ?? "");
    if (!match) return reply(404, {});
    accessRequests.push(req.url ?? "");
    const [, slug, project, page] = match;
    if (slug !== WORKSPACE || project !== PROJECT || page !== PAGE) return reply(403, {});
    if (user.access === "drop") return req.socket.destroy();
    if (user.access === "malformed") return reply(200, { access: "admin" });
    if (typeof user.access === "number") return reply(user.access, {});
    return reply(200, { access: user.access });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address: AddressInfo | string | null = server.address();
  if (address === null || typeof address === "string") throw new Error("server has no port");
  return {
    baseURL: `http://127.0.0.1:${address.port}`,
    users,
    accessRequests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
};
