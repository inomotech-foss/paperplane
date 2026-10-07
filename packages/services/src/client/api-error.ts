// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

function bodyString(data: unknown, key: string): string | undefined {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return undefined;
  const value: unknown = Reflect.get(data, key);
  return typeof value === "string" ? value : undefined;
}

/**
 * A non-2xx API response. `status` and `data` match what services threw as `error.response` with axios.
 *
 * `error`, `detail` and `code` mirror the string fields of the body, so callers that read the axios
 * `error.response.data` directly keep working.
 */
export class ApiError<TData = unknown> extends Error {
  readonly status: number;
  /** The parsed JSON body, its text when it is not JSON, or `undefined` when the body is empty. */
  readonly data: TData | undefined;
  readonly response: Response;
  readonly error: string | undefined;
  readonly detail: string | undefined;
  readonly code: string | undefined;

  constructor(response: Response, data: TData | undefined) {
    super(bodyString(data, "message") ?? `API request failed with status ${response.status}`);
    this.name = "ApiError";
    this.status = response.status;
    // openapi-fetch returns "" or undefined for an empty body, depending on the headers.
    this.data = data === "" ? undefined : data;
    this.response = response;
    this.error = bodyString(data, "error");
    this.detail = bodyString(data, "detail");
    this.code = bodyString(data, "code");
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
