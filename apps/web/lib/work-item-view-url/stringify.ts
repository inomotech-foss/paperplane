// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

// Characters valid in a query that URLSearchParams.toString() escapes anyway.
const READABLE = /%(3A|2C|3B|40|2F)/gi;

// The URL parser escapes `'` in the query of http(s) URLs, encodeURIComponent does not.
const encode = (value: string) =>
  encodeURIComponent(value)
    .replace(/%20/g, "+")
    .replace(/'/g, "%27")
    .replace(READABLE, (escaped) => decodeURIComponent(escaped));

/**
 * Like URLSearchParams.toString(), but keeps `:` `,` `;` `@` `/` readable in the address bar. The result is
 * what the browser stores, so it compares equal to `location.search`.
 */
export const stringifySearch = (params: URLSearchParams): string => {
  const parts: string[] = [];
  params.forEach((value, key) => parts.push(`${encode(key)}=${encode(value)}`));
  return parts.join("&");
};

/** The form the URL parser gives a search string, so differently escaped forms compare equal. */
export const normalizeSearch = (search: string): string =>
  new URL(`?${search.replace(/^\?/, "")}`, "http://localhost").search;
