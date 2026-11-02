/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Extension, onConfigurePayload } from "@hocuspocus/server";
import type RedisClient from "ioredis";
import { logger } from "@plane/logger";
import { ACCESS_CHANNEL, recheckAffectedConnections } from "@/lib/access-events";
import { AppError } from "@/lib/errors";
import { waitForRedisReady } from "@/lib/wait-for-redis";
import { redisManager } from "@/redis";

const duplicateSharedClient = (): RedisClient | null => redisManager.getClient()?.duplicate() ?? null;

/**
 * Re-checks open connections when the API reports an access change. Uses its own subscriber, since the Redis
 * extension reads every message on its connection as a document update.
 */
export class AccessEvents implements Extension {
  name = "AccessEvents";
  private subscriber: RedisClient | null = null;

  constructor(private readonly createSubscriber: () => RedisClient | null = duplicateSharedClient) {}

  async onConfigure({ instance }: onConfigurePayload) {
    const subscriber = this.createSubscriber();
    if (!subscriber) {
      logger.warn("[ACCESS_EVENTS] Redis is not available, access changes apply on reconnect only");
      return;
    }
    this.subscriber = subscriber;
    subscriber.on("message", (channel: string, message: string) => {
      if (channel !== ACCESS_CHANNEL) return;
      recheckAffectedConnections(instance.documents, message).catch((error: unknown) => {
        logger.error("[ACCESS_EVENTS] Re-check failed", new AppError(error));
      });
    });
    await waitForRedisReady(subscriber);
    await subscriber.subscribe(ACCESS_CHANNEL);
    logger.info(`[ACCESS_EVENTS] Subscribed to ${ACCESS_CHANNEL}`);
  }

  async onDestroy() {
    this.subscriber?.disconnect();
    this.subscriber = null;
  }
}
