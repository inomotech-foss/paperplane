// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { ApiError } from "@plane/services";
import { getApiErrorBody, getApiFieldError } from "./error.helper";

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

describe("getApiFieldError", () => {
  const apiError = (body: unknown) => new ApiError(new Response(null, { status: 400 }), body);

  it("reads a field message given as a string", () => {
    expect(getApiFieldError(apiError({ url: "Invalid or disallowed webhook URL." }), "url")).toBe(
      "Invalid or disallowed webhook URL."
    );
  });

  it("reads the first message of a list", () => {
    expect(getApiFieldError(apiError({ url: ["Enter a valid URL."] }), "url")).toBe("Enter a valid URL.");
  });

  it("returns undefined for other fields", () => {
    expect(getApiFieldError(apiError({ error: "x" }), "url")).toBeUndefined();
  });
});
