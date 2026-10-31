// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import { ProjectPageService } from "./project-page.service";

const respond = vi.hoisted(() => ({ next: (): Response => new Response(null) }));

vi.mock("@/services/api-client", async () => {
  const { createApiClient } = await import("@plane/services");
  return { apiClient: createApiClient("https://api.test", { fetch: () => Promise.resolve(respond.next()) }) };
});

describe("ProjectPageService.fetchDescriptionBinary", () => {
  it("returns an empty buffer for an empty body", async () => {
    respond.next = () => new Response(null, { status: 200, headers: { "Content-Length": "0" } });
    const binary = await new ProjectPageService().fetchDescriptionBinary("ws", "p1", "pg1");
    expect(binary).toBeInstanceOf(ArrayBuffer);
    expect(binary.byteLength).toBe(0);
  });

  it("returns the document bytes", async () => {
    respond.next = () => new Response(new Uint8Array([1, 2]), { status: 200 });
    const binary = await new ProjectPageService().fetchDescriptionBinary("ws", "p1", "pg1");
    expect(new Uint8Array(binary)).toEqual(new Uint8Array([1, 2]));
  });
});
