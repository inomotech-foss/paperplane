/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/**
 * Application error class that sanitizes and standardizes errors across the app.
 * Keeps only essential information to prevent massive log bloat and sensitive data
 * leaks (cookies, tokens, etc). `APIService` builds API errors with the status,
 * method and path.
 *
 * Usage:
 *   new AppError("Simple error message")
 *   new AppError("Custom error", { code: "MY_CODE", statusCode: 400 })
 *   new AppError(anyError)    // Works with any error type
 */
export class AppError extends Error {
  statusCode?: number;
  method?: string;
  url?: string;
  code?: string;
  context?: Record<string, unknown>;

  constructor(messageOrError: string | unknown, data?: Partial<Omit<AppError, "name" | "message">>) {
    // Handle error objects - extract essential info
    const error = messageOrError;

    // Already AppError - return immediately for performance (no need to re-process)
    if (error instanceof AppError) {
      return error;
    }

    // Handle string message (simple case like regular Error)
    if (typeof messageOrError === "string") {
      super(messageOrError);
      this.name = "AppError";
      if (data) {
        Object.assign(this, data);
      }
      return;
    }

    // DOMException (AbortError from cancelled requests)
    if (error instanceof DOMException && error.name === "AbortError") {
      super(error.message);
      this.name = "AppError";
      this.code = "ABORT_ERROR";
      return;
    }

    // Standard Error objects
    if (error instanceof Error) {
      super(error.message);
      this.name = "AppError";
      this.code = error.name;
      return;
    }

    // Unknown error types - safe fallback
    super("Unknown error occurred");
    this.name = "AppError";
  }
}
