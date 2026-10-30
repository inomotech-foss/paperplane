/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { z } from "zod";
import { logger } from "@plane/logger";
// services
import { AppError } from "@/lib/errors";
import { APIService } from "@/services/api.service";

const currentUserSchema = z.looseObject({
  id: z.string(),
  display_name: z.string(),
});

/** The user fields live reads. */
export type TCurrentUser = z.infer<typeof currentUserSchema>;

export class UserService extends APIService {
  currentUserConfig() {
    return {
      url: `${this.baseURL}/api/users/me/`,
    };
  }

  async currentUser(cookie: string): Promise<TCurrentUser> {
    try {
      return currentUserSchema.parse(await this.requestJson("GET", "/api/users/me/", { headers: { Cookie: cookie } }));
    } catch (error) {
      const appError = new AppError(error, {
        context: { operation: "currentUser" },
      });
      logger.error("Failed to fetch current user", appError);
      throw appError;
    }
  }
}
