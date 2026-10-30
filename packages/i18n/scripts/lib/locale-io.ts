/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import fs from "node:fs";
import path from "node:path";

export const LOCALES_DIR = path.resolve(import.meta.dirname, "../../src/locales");

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Recursively flatten an object into dot-notation keys. */
export function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (isRecord(v)) {
      keys.push(...flattenKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

/** Parse JSON from a file, including the file path in any error message. */
export function readJsonFile(filePath: string): Record<string, unknown> {
  const raw = fs.readFileSync(filePath, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse JSON at ${filePath}: ${message}`, { cause: err });
  }
  if (!isRecord(parsed)) throw new Error(`Expected a JSON object at ${filePath}`);
  return parsed;
}

export interface NamespaceData {
  name: string; // file stem, e.g. "common"
  keys: Set<string>;
  data: Record<string, unknown>; // original parsed object
}

export interface LocaleData {
  locale: string;
  namespaces: NamespaceData[];
  allKeys: Set<string>;
}

export function listLocales(): string[] {
  const entries = fs.readdirSync(LOCALES_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .toSorted();
}

export function loadLocale(locale: string): LocaleData {
  const localeDir = path.join(LOCALES_DIR, locale);
  const files = fs.readdirSync(localeDir).filter((f) => f.endsWith(".json"));

  const namespaces: NamespaceData[] = [];
  const allKeys = new Set<string>();

  for (const file of files) {
    const filePath = path.join(localeDir, file);
    const data = readJsonFile(filePath);
    const name = path.basename(file, ".json");
    const keys = flattenKeys(data);
    const keySet = new Set(keys);
    namespaces.push({ name, keys: keySet, data });
    for (const key of keys) {
      allKeys.add(key);
    }
  }

  return { locale, namespaces, allKeys };
}
