// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { ApiError } from "@plane/services";
import { isStateNameTaken, serverErrorMessage } from "./errors";

const apiError = (status: number, data: unknown) => new ApiError(new Response(null, { status }), data);

describe("isStateNameTaken", () => {
  it("matches the duplicate name response only", () => {
    expect(isStateNameTaken(apiError(400, { name: "The state name is already taken" }))).toBe(true);
    expect(isStateNameTaken(apiError(400, { name: ["This field may not be blank."] }))).toBe(false);
    expect(isStateNameTaken(apiError(400, undefined))).toBe(false);
    expect(isStateNameTaken(apiError(500, { name: "x" }))).toBe(false);
    expect(isStateNameTaken(new Error("x"))).toBe(false);
  });
});

describe("serverErrorMessage", () => {
  it("returns the error field of the body", () => {
    expect(serverErrorMessage(apiError(400, { error: "nope" }))).toBe("nope");
    expect(serverErrorMessage(apiError(502, undefined))).toBeUndefined();
    expect(serverErrorMessage(new Error("x"))).toBeUndefined();
  });
});
