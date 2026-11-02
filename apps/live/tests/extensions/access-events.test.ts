// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { Hocuspocus } from "@hocuspocus/server";
import RedisClient from "ioredis";
import { afterAll, describe, expect, it, vi } from "vitest";
import { AccessEvents } from "@/extensions/access-events";
import { ACCESS_CHANNEL } from "@/lib/access-events";

const received = vi.hoisted((): string[] => []);
vi.mock("@/lib/access-events", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/access-events")>()),
  recheckAffectedConnections: (_documents: unknown, message: string) => {
    received.push(message);
    return Promise.resolve();
  },
}));
vi.mock("@/redis", () => ({ redisManager: { getClient: () => null } }));
vi.mock("@/env", () => ({ env: { API_BASE_URL: "http://unused.test" } }));

const REDIS_URL = process.env.TEST_REDIS_URL;

describe("access events extension", () => {
  it("starts without Redis", async () => {
    const extension = new AccessEvents();
    const server = new Hocuspocus({ quiet: true });

    await expect(
      extension.onConfigure({ instance: server, configuration: server.configuration, version: "" })
    ).resolves.toBeUndefined();
    await extension.onDestroy();
  });

  describe.skipIf(!REDIS_URL)("with Redis", () => {
    const publisher = new RedisClient(`${REDIS_URL}`);
    const extension = new AccessEvents(() => new RedisClient(`${REDIS_URL}`));

    afterAll(async () => {
      await extension.onDestroy();
      publisher.disconnect();
    });

    it("passes messages on the access channel to the re-check, and nothing else", async () => {
      const server = new Hocuspocus({ quiet: true });
      await extension.onConfigure({ instance: server, configuration: server.configuration, version: "" });

      await publisher.publish("hocuspocus:admin", '{"user":"admin"}');
      await publisher.publish(ACCESS_CHANNEL, '{"user":"member"}');

      await vi.waitFor(() => expect(received).toEqual(['{"user":"member"}']));
    });
  });
});
