// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import createClient from "openapi-fetch";
import type { Client, ClientOptions, Middleware } from "openapi-fetch";
import { ensureAPITrailingSlash } from "../helpers/url";
import { ApiError } from "./api-error";

export type ApiClient<Paths extends object> = Client<Paths>;

export type ApiClientOptions = {
  /** Called on every 401 response, before the request fails. */
  onUnauthorized?: () => void;
  /** Replaces the global fetch, e.g. in tests. */
  fetch?: ClientOptions["fetch"];
};

// Django needs the trailing slash; ingress may fail instead of redirecting.
const trailingSlashMiddleware: Middleware = {
  onRequest({ request }) {
    const url = ensureAPITrailingSlash(request.url);
    return url === request.url ? undefined : new Request(url, request);
  },
};

function unauthorizedMiddleware(onUnauthorized: () => void): Middleware {
  return {
    onResponse({ response }) {
      if (response.status === 401) onUnauthorized();
    },
  };
}

/** A typed fetch client for one API surface, with the session cookie sent on every request. */
export function createApiClient<Paths extends object>(
  baseUrl: string,
  options: ApiClientOptions = {}
): ApiClient<Paths> {
  const client = createClient<Paths>({
    baseUrl,
    credentials: "include",
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  client.use(trailingSlashMiddleware);
  if (options.onUnauthorized) client.use(unauthorizedMiddleware(options.onUnauthorized));
  return client;
}

/** The shape of every openapi-fetch result. */
type FetchResult = { data?: unknown; error?: unknown; response: Response };

type Success<R extends FetchResult> = Extract<R, { data: unknown }>;

/** The success body of an openapi-fetch result. */
export type ResultData<R extends FetchResult> = Success<R>["data"];

function isSuccess<R extends FetchResult>(result: R): result is Success<R> {
  return result.response.ok;
}

/** Returns the response body of an openapi-fetch call, or throws an `ApiError` for a non-2xx status. */
export async function unwrap<R extends FetchResult>(request: Promise<R>): Promise<ResultData<R>> {
  const result = await request;
  if (isSuccess(result)) return result.data;
  throw new ApiError(result.response, result.error);
}
