/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Hocuspocus } from "@hocuspocus/server";
import type { Request } from "express";
import type WebSocket from "ws";
// plane imports
import { Controller, WebSocket as WSDecorator } from "@plane/decorators";
import { logger } from "@plane/logger";

const HEARTBEAT_INTERVAL_MS = 30_000;

// Hocuspocus detaches unresponsive clients from their documents but leaves the socket open.
const terminateWhenUnresponsive = (ws: WebSocket) => {
  let isAlive = true;
  ws.on("pong", () => {
    isAlive = true;
  });
  const heartbeat = setInterval(() => {
    if (!isAlive) {
      ws.terminate();
      return;
    }
    isAlive = false;
    ws.ping();
  }, HEARTBEAT_INTERVAL_MS);
  ws.once("close", () => clearInterval(heartbeat));
};

@Controller("/collaboration")
export class CollaborationController {
  [key: string]: unknown;
  private readonly hocusPocusServer: Hocuspocus;

  constructor(hocusPocusServer: Hocuspocus) {
    this.hocusPocusServer = hocusPocusServer;
  }

  @WSDecorator("/")
  handleConnection(ws: WebSocket, req: Request) {
    try {
      // Initialize the connection with Hocuspocus
      this.hocusPocusServer.handleConnection(ws, req);
      terminateWhenUnresponsive(ws);

      // Set up error handling for the connection
      ws.on("error", (error: Error) => {
        logger.error("COLLABORATION_CONTROLLER: WebSocket connection error:", error);
        ws.close(1011, "Internal server error");
      });
    } catch (error) {
      logger.error("COLLABORATION_CONTROLLER: WebSocket connection error:", error);
      ws.close(1011, "Internal server error");
    }
  }
}
