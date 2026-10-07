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

  it("copies body keys so readers of error.response.data keep working", () => {
    const error = new ApiError(response(400), { error: "taken", detail: "x", status: "ignored" });
    expect(error).toMatchObject({ error: "taken", detail: "x", status: 400 });
  });

  it("uses the body message as the error message", () => {
    expect(new ApiError(response(400), { message: "nope" }).message).toBe("nope");
    expect(new ApiError(response(500), "Server Error").message).toBe("API request failed with status 500");
  });
});
