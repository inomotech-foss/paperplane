// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { ApiError } from "@plane/services";
import { getApiErrorBody } from "./error.helper";

describe("getApiErrorBody", () => {
  it("returns the body of an ApiError", () => {
    const body = { name: ["PROJECT_NAME_ALREADY_EXIST"] };
    expect(getApiErrorBody(new ApiError(new Response(null, { status: 400 }), body))).toBe(body);
  });

  it("returns any other error as it is", () => {
    const body = { error: "x" };
    expect(getApiErrorBody(body)).toBe(body);
  });
});
