/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Router, Request } from "express";
import type { WebSocket } from "ws";

import "reflect-metadata";
import { getMiddlewares, getStringMetadata } from "./metadata";

export type HttpMethod = "get" | "post" | "put" | "delete" | "patch" | "options" | "head" | "ws";

export type ControllerConstructor<TArgs extends unknown[] = unknown[]> = {
  new (...args: TArgs): object;
  prototype: object;
};

type ControllerClass = { name: string; prototype: object };

type Handler = (...args: unknown[]) => unknown;

const isHandler = (value: unknown): value is Handler => typeof value === "function";

type WebSocketRouter = Router & {
  ws: (path: string, handler: (ws: WebSocket, req: Request) => void) => unknown;
};

// express-ws adds ws() to the router at runtime.
const hasWebSocketRoutes = (router: Router): router is WebSocketRouter =>
  "ws" in router && typeof router.ws === "function";

const isRestMethod = (value: string | undefined): value is Exclude<HttpMethod, "ws"> =>
  value === "get" ||
  value === "post" ||
  value === "put" ||
  value === "delete" ||
  value === "patch" ||
  value === "options" ||
  value === "head";

export function registerController<TArgs extends unknown[]>(
  router: Router,
  Controller: ControllerConstructor<TArgs>,
  dependencies: TArgs
): void {
  // Create the controller instance with dependencies
  const instance = new Controller(...dependencies);

  // Determine if it's a WebSocket controller or REST controller by checking
  // if it has any methods with the "ws" method metadata
  const isWebsocket = Object.getOwnPropertyNames(Controller.prototype).some((methodName) => {
    if (methodName === "constructor") return false;
    return getStringMetadata("method", instance, methodName) === "ws";
  });

  if (isWebsocket) {
    registerWebSocketController(router, Controller, instance);
  } else {
    registerRestController(router, Controller, instance);
  }
}

function registerRestController(router: Router, Controller: ControllerClass, instance: object): void {
  const baseRoute = getStringMetadata("baseRoute", Controller) ?? "";

  Object.getOwnPropertyNames(Controller.prototype).forEach((methodName) => {
    if (methodName === "constructor") return; // Skip the constructor

    const method = getStringMetadata("method", instance, methodName);
    const route = getStringMetadata("route", instance, methodName);
    const middlewares = getMiddlewares(instance, methodName);

    if (method && route) {
      const handler: unknown = Reflect.get(instance, methodName);

      if (isHandler(handler) && isRestMethod(method)) {
        router[method](`${baseRoute}${route}`, ...middlewares, handler.bind(instance));
      }
    }
  });
}

function registerWebSocketController(router: Router, Controller: ControllerClass, instance: object): void {
  const baseRoute = getStringMetadata("baseRoute", Controller) ?? "";

  Object.getOwnPropertyNames(Controller.prototype).forEach((methodName) => {
    if (methodName === "constructor") return; // Skip the constructor

    const method = getStringMetadata("method", instance, methodName);
    const route = getStringMetadata("route", instance, methodName);

    if (method === "ws" && route) {
      const handler: unknown = Reflect.get(instance, methodName);

      if (isHandler(handler) && hasWebSocketRoutes(router)) {
        router.ws(`${baseRoute}${route}`, (ws: WebSocket, req: Request) => {
          try {
            handler.call(instance, ws, req);
          } catch (error) {
            console.error(`WebSocket error in ${Controller.name}.${methodName}`, error);
            ws.close(1011, error instanceof Error ? error.message : "Internal server error");
          }
        });
      }
    }
  });
}
