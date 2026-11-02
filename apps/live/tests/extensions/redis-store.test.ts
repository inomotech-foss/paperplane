// SPDX-License-Identifier: AGPL-3.0-only

import { Document, Hocuspocus } from "@hocuspocus/server";
import type { onStoreDocumentPayload } from "@hocuspocus/server";
import { ExecutionError, ResourceLockedError } from "@sesamecare-oss/redlock";
import RedisClient from "ioredis";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Redis } from "@/extensions/redis";

const client = vi.hoisted(() => {
  const state: { current: RedisClient | null } = { current: null };
  return state;
});
vi.mock("@/redis", () => ({ redisManager: { getClient: () => client.current } }));

client.current = new RedisClient({ lazyConnect: true, port: 1 });

const QUORUM = "The operation was unable to achieve a quorum during its retry window.";

describe("Redis store lock", () => {
  const stored: string[] = [];
  const redis = new Redis();
  vi.spyOn(redis, "onConfigure").mockResolvedValue(undefined);
  const server = new Hocuspocus({
    quiet: true,
    extensions: [
      redis,
      {
        onStoreDocument: async ({ documentName }) => {
          stored.push(documentName);
        },
      },
    ],
  });
  const payload: onStoreDocumentPayload = {
    clientsCount: 0,
    context: {},
    document: new Document("page"),
    documentName: "page",
    instance: server,
    requestHeaders: {},
    requestParameters: new URLSearchParams(),
    socketId: "server",
  };

  const rejectLock = (vote: Error) => {
    const votesAgainst = new Map([[redis.pub, vote]]);
    const stats = { membershipSize: 1, quorumSize: 1, votesFor: new Set<RedisClient>(), votesAgainst };
    vi.spyOn(redis.redlock, "acquire").mockRejectedValue(new ExecutionError(QUORUM, [Promise.resolve(stats)]));
  };

  beforeEach(() => {
    stored.length = 0;
    vi.restoreAllMocks();
  });

  afterAll(() => {
    redis.pub.disconnect();
    redis.sub.disconnect();
    client.current?.disconnect();
  });

  it("still stores the document when Redis is unreachable", async () => {
    rejectLock(new Error("Reached the max retries per request limit (which is 3)."));
    await server.hooks("onStoreDocument", payload);
    expect(stored).toEqual(["page"]);
  });

  it("still stores the document on an unexpected lock error", async () => {
    vi.spyOn(redis.redlock, "acquire").mockRejectedValue(new Error("Connection is closed."));
    await server.hooks("onStoreDocument", payload);
    expect(stored).toEqual(["page"]);
  });

  it("skips the store while another instance holds the lock", async () => {
    rejectLock(new ResourceLockedError("locked"));
    await expect(server.hooks("onStoreDocument", payload)).rejects.toThrow(expect.objectContaining({ message: "" }));
    expect(stored).toEqual([]);
  });
});

describe("Redis subscribe on load", () => {
  it("fails the load when the subscribe never answers", async () => {
    const redis = new Redis(50);
    // never calls back, like a subscribe queued while Redis is unreachable
    vi.spyOn(redis.sub, "subscribe").mockReturnValue(new Promise<never>(() => {}));
    const server = new Hocuspocus({ quiet: true });
    const document = new Document("page");

    await expect(
      redis.afterLoadDocument({
        context: {},
        document,
        documentName: "page",
        instance: server,
        requestHeaders: {},
        requestParameters: new URLSearchParams(),
        socketId: "socket",
        connectionConfig: { readOnly: false, isAuthenticated: true },
      })
    ).rejects.toMatchObject({ reason: "document-load-timeout" });

    redis.pub.disconnect();
    redis.sub.disconnect();
  });
});
