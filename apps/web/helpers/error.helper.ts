/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { isApiError } from "@plane/services";
import type { TAuthErrorInfo } from "@/helpers/authentication.helper";
import { authErrorHandler, EAuthenticationErrorCodes } from "@/helpers/authentication.helper";
import { isOneOf, readField, readString } from "@plane/types";

/** The body of a failed typed client request, or `error` itself when it was thrown as the body. */
export const getApiErrorBody = (error: unknown): unknown => (isApiError(error) ? error.data : error);

/** Reads the `error` message the API puts in a failed response body. */
export const getApiErrorMessage = (error: unknown): string | undefined => readString(error, "error");

/** The first message the API gives for `field`, as a string or a list of strings. */
export const getApiFieldError = (error: unknown, field: string): string | undefined => {
  const value = readField(getApiErrorBody(error), field);
  if (typeof value === "string") return value;
  return Array.isArray(value) ? value.find((item): item is string => typeof item === "string") : undefined;
};

const AUTH_ERROR_CODES = Object.values(EAuthenticationErrorCodes);

/** Maps an untyped error code (string or number) to its auth error code. */
export const toAuthErrorCode = (code: unknown): EAuthenticationErrorCodes | undefined => {
  if (typeof code !== "string" && typeof code !== "number") return undefined;
  const value = code.toString();
  return isOneOf(AUTH_ERROR_CODES, value) ? value : undefined;
};

/** Runs `authErrorHandler` for an untyped error code. Unknown codes give `undefined`. */
export const getAuthErrorInfo = (
  code: unknown,
  email?: string | null,
  provider?: string | null
): TAuthErrorInfo | undefined => {
  const errorCode = toAuthErrorCode(code);
  return errorCode ? authErrorHandler(errorCode, email, provider) : undefined;
};
