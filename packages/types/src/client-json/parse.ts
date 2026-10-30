// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { z } from "zod";

const warned = new Set<string>();

const isUnset = (value: unknown) =>
  value === null ||
  value === undefined ||
  (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0);

/**
 * Parses a JSON field the client owns. Returns `fallback` for data that does not match `schema`, and logs the first
 * failure of each `name` once. Null and empty objects, which the backend stores before the client writes anything,
 * fall back quietly when the schema rejects them.
 */
export function parseClientJson<S extends z.ZodType>(
  name: string,
  schema: S,
  value: unknown,
  fallback: z.output<S>
): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success && isUnset(value)) return fallback;
  if (result.success) return result.data;
  if (!warned.has(name)) {
    warned.add(name);
    console.warn(`Ignoring malformed ${name}, using the default.`, result.error.issues);
  }
  return fallback;
}

/** Forgets which fields already logged. For tests. */
export function resetClientJsonWarnings(): void {
  warned.clear();
}
