// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { PageApprovalService } from "./page-approval.service";

const http = vi.hoisted(() => ({ requests: [] as Request[], next: (): Response => new Response(null) }));

vi.mock("@/services/api-client", async () => {
  const { createApiClient } = await import("@plane/services");
  return {
    apiClient: createApiClient("https://api.test", {
      fetch: (request: Request) => {
        http.requests.push(request);
        return Promise.resolve(http.next());
      },
    }),
  };
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("PageApprovalService baseline", () => {
  beforeEach(() => {
    http.requests = [];
  });

  it("reads the preview of the project", async () => {
    const preview = { pages: [], totals: { pages: 0, eligible: 0, locked: 0, skipped: 0 } };
    http.next = () => json(preview);

    expect(await new PageApprovalService().baselinePreview("ws", "p1")).toEqual(preview);
    const [request] = http.requests;
    expect(request.method).toBe("GET");
    expect(new URL(request.url).pathname).toBe("/api/workspaces/ws/projects/p1/page-approvals/baseline/");
  });

  it("posts the chosen pages and returns how many were queued", async () => {
    http.next = () => json({ queued: 2, skipped: 1 }, 202);
    const body = { page_ids: ["a", "b"], include_locked: false, next_review_date: null, comment: "" };

    expect(await new PageApprovalService().baseline("ws", "p1", body)).toEqual({ queued: 2, skipped: 1 });
    const [request] = http.requests;
    expect(request.method).toBe("POST");
    expect(new URL(request.url).pathname).toBe("/api/workspaces/ws/projects/p1/page-approvals/baseline/");
    expect(await request.json()).toEqual(body);
  });
});
