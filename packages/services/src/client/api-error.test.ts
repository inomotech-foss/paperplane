// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { ApiError } from "./api-error";

const response = (status: number) => new Response(null, { status });

describe("ApiError", () => {
  it("exposes the status and the body like axios error.response", () => {
    const error = new ApiError(response(400), { error: "taken" });
    expect(error).toMatchObject({ status: 400, data: { error: "taken" } });
  });

  it("mirrors only error, detail and code", () => {
    const body = { error: "taken", detail: "x", code: "c", status: "s", name: "n", data: "d", toString: "t" };
    const error = new ApiError(response(400), body);
    expect(error).toMatchObject({ error: "taken", detail: "x", code: "c", status: 400, name: "ApiError", data: body });
    expect(String(error)).toBe("ApiError: API request failed with status 400");
  });

  it("mirrors only string values", () => {
    const error = new ApiError(response(400), { error: ["a"], detail: 1 });
    expect(error.error).toBeUndefined();
    expect(error.detail).toBeUndefined();
  });

  it("has undefined data for an empty body", () => {
    expect(new ApiError(response(500), "").data).toBeUndefined();
    expect(new ApiError(response(500), undefined).data).toBeUndefined();
    expect(new ApiError(response(500), undefined).error).toBeUndefined();
  });

  it("uses the body message as the error message", () => {
    expect(new ApiError(response(400), { message: "nope" }).message).toBe("nope");
    expect(new ApiError(response(500), "Server Error").message).toBe("API request failed with status 500");
  });
});
