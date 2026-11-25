/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  getStatus: vi.fn(),
  listEvents: vi.fn(),
  submit: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  setReviewDate: vi.fn(),
}));

vi.mock("@/services/page", () => ({
  PageApprovalService: vi.fn(function PageApprovalService() {
    return service;
  }),
}));

const { PageApprovalStore } = await import("./page-approval.store");

const status = (overrides: Record<string, unknown> = {}) => ({
  enabled: true,
  status: "approved",
  revision: 1,
  approved_version: "v1",
  ...overrides,
});

describe("PageApprovalStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.listEvents.mockResolvedValue([]);
  });

  it("loads the status of its own page", async () => {
    service.getStatus.mockResolvedValue(status());
    const store = new PageApprovalStore("acme", "project", "page");

    await store.fetch();

    expect(service.getStatus).toHaveBeenCalledWith("acme", "project", "page");
    expect(store.isEnabled).toBe(true);
  });

  it("takes the status an action returns and refreshes the log", async () => {
    service.approve.mockResolvedValue(status({ revision: 2 }));
    service.listEvents.mockResolvedValue([{ id: "e", action: "approved" }]);
    const store = new PageApprovalStore("acme", "project", "page");

    await store.approve("Fine", "2027-01-01");

    expect(service.approve).toHaveBeenCalledWith("acme", "project", "page", {
      comment: "Fine",
      next_review_date: "2027-01-01",
    });
    expect(store.status?.revision).toBe(2);
    expect(store.events).toHaveLength(1);
  });

  it("switches between the approved version and the draft", async () => {
    service.getStatus.mockResolvedValue(status());
    const store = new PageApprovalStore("acme", "project", "page");
    await store.fetch();

    expect(store.showsApproved(true)).toBe(false);
    store.setViewMode("approved");
    expect(store.showsApproved(true)).toBe(true);
  });

  it("refuses to call the API without a page", async () => {
    const store = new PageApprovalStore("acme", undefined, "page");

    await expect(store.submit("")).rejects.toThrow("Missing required fields.");
    expect(service.submit).not.toHaveBeenCalled();
  });
});
