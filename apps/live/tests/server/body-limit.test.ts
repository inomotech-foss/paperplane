/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import express from "express";
import type { AddressInfo } from "node:net";
import { describe, it, expect, beforeAll } from "vitest";

// Importing env validates process.env and exits when a required key is absent.
process.env.API_BASE_URL ??= "http://localhost:8000/";
process.env.LIVE_SERVER_SECRET_KEY ??= "test-secret";

// A page from a real Confluence import that express's 100kb default rejected,
// so /convert-document answered 413 and duplicating the page failed.
const PAGE_HTML = `<p>${"x".repeat(125_000)}</p>`;

let limit: string;

beforeAll(async () => {
  ({
    env: { BODY_SIZE_LIMIT: limit },
  } = await import("@/env"));
});

const post = async (bodyLimit: string, html: string) => {
  const app = express();
  app.use(express.json({ limit: bodyLimit }));
  app.post("/", (_request, response) => {
    response.status(200).end();
  });

  const server = app.listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description_html: html, variant: "document" }),
    });
    return response.status;
  } finally {
    server.close();
  }
};

describe("request body limit", () => {
  it("accepts a whole page of HTML", async () => {
    expect(await post(limit, PAGE_HTML)).toBe(200);
  });

  it("is what makes that page fit, not the payload being small", async () => {
    expect(await post("100kb", PAGE_HTML)).toBe(413);
  });
});
