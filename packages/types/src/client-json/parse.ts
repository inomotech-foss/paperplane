// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { z } from "zod";
import { isRecord } from "../narrow";

const warned = new Set<string>();

const isUnset = (value: unknown) =>
  value === null || value === undefined || (isRecord(value) && !Object.keys(value).length);

/** Logs the first problem of each `name` once. */
export function warnClientJson(name: string, details: unknown): void {
  if (warned.has(name)) return;
  warned.add(name);
  console.warn(`Ignoring malformed ${name}, using the default.`, details);
}

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
  if (result.success) return result.data;
  if (!isUnset(value)) warnClientJson(name, result.error.issues);
  return fallback;
}

/**
 * Parses a JSON object the client owns one field at a time. A field that does not match its schema falls back to its
 * value in `fallback`, so one bad field does not reset the others. Keys outside `shape` are kept as they are, so
 * writing the object back does not lose them.
 */
export function parseClientObject<Shape extends z.ZodRawShape>(
  name: string,
  shape: Shape,
  value: unknown,
  fallback: z.output<z.ZodObject<Shape>>
): z.output<z.ZodObject<Shape>> {
  if (isUnset(value)) return fallback;
  if (!isRecord(value)) {
    warnClientJson(name, value);
    return fallback;
  }
  const fallbackFields: Record<string, unknown> = fallback;
  const fields: Record<string, unknown> = { ...value };
  for (const [key, schema] of Object.entries(shape)) {
    const result = z.safeParse(schema, value[key]);
    if (result.success) {
      if (result.data !== undefined) fields[key] = result.data;
    } else {
      warnClientJson(`${name}.${key}`, result.error.issues);
      if (fallbackFields[key] === undefined) delete fields[key];
      else fields[key] = fallbackFields[key];
    }
  }
  const parsed = z.looseObject(shape).safeParse(fields);
  return parsed.success ? { ...fields, ...parsed.data } : fallback;
}

/** Forgets which fields already logged. For tests. */
export function resetClientJsonWarnings(): void {
  warned.clear();
}
