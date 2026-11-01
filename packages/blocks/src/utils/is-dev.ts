/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { readField } from "@plane/types";

// Detects a non-production build without requiring @types/node. Evaluated once at module load.
export const IS_DEV = (() => {
  const proc: unknown = Reflect.get(globalThis, "process");
  return proc ? readField(readField(proc, "env"), "NODE_ENV") !== "production" : false;
})();
