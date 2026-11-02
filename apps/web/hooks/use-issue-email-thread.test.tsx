/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useIssueEmailThread } from "./use-issue-email-thread";

const { getEmailThread, allowPermissions } = vi.hoisted(() => ({
  getEmailThread: vi.fn(),
  allowPermissions: vi.fn(),
}));

vi.mock("@/services/service-desk.service", () => ({
  ServiceDeskService: class {
    getEmailThread = getEmailThread;
  },
}));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions }) }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

describe("useIssueEmailThread", () => {
  beforeEach(() => {
    getEmailThread.mockReset();
    allowPermissions.mockReset().mockReturnValue(true);
  });

  it("returns null for a work item without a thread", async () => {
    getEmailThread.mockResolvedValue(null);
    const { result } = renderHook(() => useIssueEmailThread("ws", "p1", "i1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getEmailThread).toHaveBeenCalledWith("ws", "p1", "i1");
    expect(result.current.emailThread).toBeNull();
  });

  it("does not fetch for guests", () => {
    allowPermissions.mockReturnValue(false);
    const { result } = renderHook(() => useIssueEmailThread("ws", "p1", "i1"), { wrapper });
    expect(getEmailThread).not.toHaveBeenCalled();
    expect(result.current.emailThread).toBeNull();
  });
});
