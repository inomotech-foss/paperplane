// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

const RESERVED_KEYS = new Set(["data", "message", "name", "response", "stack", "status"]);

function bodyMessage(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const message: unknown = Reflect.get(data, "message");
  return typeof message === "string" ? message : undefined;
}

/**
 * A non-2xx API response. `status` and `data` (the parsed body, or its text when it is not JSON)
 * match what services threw as `error.response` with axios.
 *
 * The body's own keys are also copied onto the error, so callers that read the axios
 * `error.response.data` directly (`error.error`, `error.detail`) keep working.
 */
export class ApiError<TData = unknown> extends Error {
  readonly status: number;
  readonly data: TData;
  readonly response: Response;

  constructor(response: Response, data: TData) {
    super(bodyMessage(data) ?? `API request failed with status ${response.status}`);
    this.name = "ApiError";
    this.status = response.status;
    this.data = data;
    this.response = response;
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      for (const key of Object.keys(data)) {
        if (RESERVED_KEYS.has(key)) continue;
        const value: unknown = Reflect.get(data, key);
        Object.defineProperty(this, key, { value, enumerable: true });
      }
    }
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
