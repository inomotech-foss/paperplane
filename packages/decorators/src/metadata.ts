/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { RequestHandler } from "express";

const readMetadata = (key: string, target: object, propertyKey?: string | symbol): unknown =>
  propertyKey === undefined ? Reflect.getMetadata(key, target) : Reflect.getMetadata(key, target, propertyKey);

export const getStringMetadata = (key: string, target: object, propertyKey?: string): string | undefined => {
  const value = readMetadata(key, target, propertyKey);
  return typeof value === "string" ? value : undefined;
};

export const getMiddlewares = (target: object, propertyKey: string | symbol): RequestHandler[] => {
  const value = readMetadata("middlewares", target, propertyKey);
  return Array.isArray(value) ? value.filter((item): item is RequestHandler => typeof item === "function") : [];
};
