// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { SWRConfiguration } from "swr";

const RETRYABLE_CLIENT_ERRORS = new Set([408, 429]);

const errorStatus = (error: unknown): number | undefined => {
  if (typeof error !== "object" || error === null || !("status" in error)) return undefined;
  return typeof error.status === "number" ? error.status : undefined;
};

/** A 4xx answer will not change on retry, apart from timeouts and rate limits. */
export const shouldRetryOnError = (error: unknown): boolean => {
  const status = errorStatus(error);
  if (status === undefined) return true;
  return status < 400 || status >= 500 || RETRYABLE_CLIENT_ERRORS.has(status);
};

// The MobX stores are the cache. Most fetches only fill them, so a focus refetch is a wasted request.
// Hooks that show data other users change, such as notifications, opt back in.
export const WEB_SWR_CONFIG: SWRConfiguration = {
  refreshWhenHidden: false,
  revalidateIfStale: true,
  revalidateOnFocus: false,
  revalidateOnMount: true,
  errorRetryCount: 3,
  shouldRetryOnError,
};
