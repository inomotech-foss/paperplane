// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import useSWR, { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import { shouldRetryOnError, WEB_SWR_CONFIG } from "./swr-config";

class StatusError extends Error {
  constructor(readonly status: number) {
    super(`status ${status}`);
  }
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ ...WEB_SWR_CONFIG, provider: () => new Map(), errorRetryInterval: 1 }}>{children}</SWRConfig>
  );
}

const failWith = (status: number) => vi.fn(() => Promise.reject(new StatusError(status)));

describe("shouldRetryOnError", () => {
  it("skips client errors except timeouts and rate limits", () => {
    expect(shouldRetryOnError(new StatusError(404))).toBe(false);
    expect(shouldRetryOnError(new StatusError(403))).toBe(false);
    expect(shouldRetryOnError(new StatusError(408))).toBe(true);
    expect(shouldRetryOnError(new StatusError(429))).toBe(true);
    expect(shouldRetryOnError(new StatusError(502))).toBe(true);
    expect(shouldRetryOnError(new Error("network"))).toBe(true);
  });
});

describe("WEB_SWR_CONFIG", () => {
  it("does not retry a 404", async () => {
    const fetcher = failWith(404);
    const { result } = renderHook(() => useSWR("not-found", fetcher), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(StatusError));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("retries a server error", async () => {
    const fetcher = failWith(500);
    renderHook(() => useSWR("server-error", fetcher), { wrapper: Wrapper });
    await waitFor(() => expect(fetcher.mock.calls.length).toBeGreaterThan(1));
  });
});
