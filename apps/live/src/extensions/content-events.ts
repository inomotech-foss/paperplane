/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Extension, onConfigurePayload } from "@hocuspocus/server";
import type RedisClient from "ioredis";
import { logger } from "@plane/logger";
import { CONTENT_CHANNEL, applyContentEvent } from "@/lib/content-events";
import type { TClaimContentEvent } from "@/lib/content-events";
import { AppError } from "@/lib/errors";
import { waitForRedisReady } from "@/lib/wait-for-redis";
import { redisManager } from "@/redis";

const CLAIM_TTL_SECONDS = 60;

const sharedClient = (): RedisClient | null => redisManager.getClient();

/**
 * Applies page bodies the API writes to the documents this server holds open. Uses its own subscriber, since the
 * Redis extension reads every message on its connection as a document update.
 */
export class ContentEvents implements Extension {
  name = "ContentEvents";
  private subscriber: RedisClient | null = null;

  constructor(private readonly getClient: () => RedisClient | null = sharedClient) {}

  async onConfigure({ instance }: onConfigurePayload) {
    const client = this.getClient();
    if (!client) {
      logger.warn(
        "[CONTENT_EVENTS] Redis is not available, a page body written through the API reaches an open page only after it is reloaded"
      );
      return;
    }
    const claim: TClaimContentEvent = async (eventId) =>
      (await client.set(`${CONTENT_CHANNEL}:${eventId}`, "1", "EX", CLAIM_TTL_SECONDS, "NX")) === "OK";

    const subscriber = client.duplicate();
    this.subscriber = subscriber;
    subscriber.on("message", (channel: string, message: string) => {
      if (channel !== CONTENT_CHANNEL) return;
      applyContentEvent(instance, message, claim).catch((error: unknown) => {
        logger.error("[CONTENT_EVENTS] Applying a page body failed", new AppError(error));
      });
    });
    await waitForRedisReady(subscriber);
    await subscriber.subscribe(CONTENT_CHANNEL);
    logger.info(`[CONTENT_EVENTS] Subscribed to ${CONTENT_CHANNEL}`);
  }

  async onDestroy() {
    this.subscriber?.disconnect();
    this.subscriber = null;
  }
}
