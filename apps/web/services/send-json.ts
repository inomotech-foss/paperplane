/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import { ApiError } from "@plane/services";

type TSendJsonOptions = {
  method?: "POST" | "PATCH";
  baseUrl?: string;
  fetch?: typeof fetch;
};

function parseBody(text: string): unknown {
  if (text === "") return undefined;
  try {
    const data: unknown = JSON.parse(text);
    return data;
  } catch {
    return text;
  }
}

/**
 * Sends a JSON body to an endpoint whose generated types lack the request body.
 * Returns the parsed response body for the caller to validate. Throws an `ApiError` for a non-2xx status.
 */
export async function sendJson(path: string, body: unknown, options: TSendJsonOptions = {}): Promise<unknown> {
  const { method = "POST", baseUrl = API_BASE_URL, fetch: fetchImpl = fetch } = options;
  const response = await fetchImpl(`${baseUrl}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = parseBody(await response.text());
  if (!response.ok) throw new ApiError(response, data);
  return data;
}
