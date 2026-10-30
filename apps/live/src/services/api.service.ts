/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { normalizeAPIRequestURL } from "@plane/services";
import { env } from "@/env";
import { AppError } from "@/lib/errors";

const TIMEOUT_MS = 20000;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RequestOptions = {
  headers?: Record<string, string>;
  query?: Record<string, string>;
  /** Sent as JSON. */
  body?: unknown;
  signal?: AbortSignal;
  /** With "manual", a 3xx response is returned instead of followed. */
  redirect?: "follow" | "manual";
};

function bodyMessage(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const message: unknown = Reflect.get(data, "message");
  return typeof message === "string" && message ? message : undefined;
}

function causeCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  const { cause } = error;
  if (typeof cause !== "object" || cause === null || !("code" in cause)) return undefined;
  return typeof cause.code === "string" ? cause.code : undefined;
}

/** The JSON body, its text when it is not JSON, or `undefined` when it is empty. */
export async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === "") return undefined;
  try {
    const data: unknown = JSON.parse(text);
    return data;
  } catch {
    return text;
  }
}

export abstract class APIService {
  protected baseURL: string;
  private header: Record<string, string> = {};

  constructor(baseURL?: string) {
    this.baseURL = baseURL || env.API_BASE_URL;
  }

  setHeader(key: string, value: string) {
    this.header[key] = value;
  }

  getHeader() {
    return this.header;
  }

  private buildURL(path: string, query: Record<string, string> | undefined): string {
    const search = query ? new URLSearchParams(query).toString() : "";
    const separator = path.includes("?") ? "&" : "?";
    const pathWithQuery = search ? `${path}${separator}${search}` : path;
    return `${this.baseURL.replace(/\/+$/, "")}/${pathWithQuery.replace(/^\/+/, "")}`;
  }

  /**
   * Sends a request with the headers set through `setHeader`.
   *
   * Throws an `AppError` with the status, method and path for a non-2xx response, a network error or a timeout.
   */
  protected async request(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<Response> {
    const { headers, query, body, signal, redirect } = options;
    let url = path;
    try {
      url = normalizeAPIRequestURL(path, this.baseURL);
    } catch (error) {
      console.warn("[APIService] Failed to normalize trailing slash:", path, error);
    }
    const timeout = AbortSignal.timeout(TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(this.buildURL(url, query), {
        method,
        headers: {
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...this.header,
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        ...(redirect ? { redirect } : {}),
      });
    } catch (error) {
      if (signal?.aborted) throw new AppError(new DOMException("Aborted", "AbortError"));
      if (timeout.aborted) {
        throw new AppError(`timeout of ${TIMEOUT_MS}ms exceeded`, { method, url, code: "ECONNABORTED" });
      }
      const message = error instanceof Error ? error.message : "Network Error";
      throw new AppError(message, { method, url, code: causeCode(error) ?? "ERR_NETWORK" });
    }

    const isRedirect = redirect === "manual" && response.status >= 300 && response.status < 400;
    if (response.ok || isRedirect) return response;

    const data = await readBody(response).catch(() => undefined);
    throw new AppError(bodyMessage(data) ?? `Request failed with status code ${response.status}`, {
      statusCode: response.status,
      method,
      url,
      code: response.status >= 500 ? "ERR_BAD_RESPONSE" : "ERR_BAD_REQUEST",
    });
  }

  /** Same as `request`, returning the parsed body. */
  protected async requestJson(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<unknown> {
    return readBody(await this.request(method, path, options));
  }
}
