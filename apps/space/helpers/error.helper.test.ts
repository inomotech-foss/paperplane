/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { ApiError } from "@plane/services";
import { EAuthenticationErrorCodes, getAuthErrorInfo, toAuthErrorCode } from "./authentication.helper";
import { getApiErrorField } from "./error.helper";

describe("getApiErrorField", () => {
  it("reads a field from the API error body", () => {
    const error = new ApiError(new Response(null, { status: 400 }), { error_code: 5005 });
    expect(getApiErrorField(error, "error_code")).toBe(5005);
  });

  it("returns undefined for other errors", () => {
    expect(getApiErrorField(new Error("x"), "error_code")).toBeUndefined();
  });
});

describe("toAuthErrorCode", () => {
  it("maps numeric and string codes", () => {
    expect(toAuthErrorCode(5005)).toBe(EAuthenticationErrorCodes.INVALID_EMAIL);
    expect(toAuthErrorCode("5065")).toBe(EAuthenticationErrorCodes.AUTHENTICATION_FAILED_SIGN_IN);
  });

  it("rejects unknown codes", () => {
    expect(toAuthErrorCode("9999")).toBeUndefined();
    expect(toAuthErrorCode(null)).toBeUndefined();
    expect(getAuthErrorInfo("9999")).toBeUndefined();
  });
});
