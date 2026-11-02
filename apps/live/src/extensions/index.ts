/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { env } from "@/env";
import { Database } from "./database";
import { ForceCloseHandler } from "./force-close-handler";
import { Logger } from "./logger";
import { Redis } from "./redis";
import { TitleSyncExtension } from "./title-sync";

export const getExtensions = () => [
  new Logger(),
  new Database({ loadTimeoutMs: env.DOCUMENT_LOAD_TIMEOUT_MS }),
  new Redis(),
  new TitleSyncExtension(),
  new ForceCloseHandler(), // Must be after Redis to receive broadcasts
];
