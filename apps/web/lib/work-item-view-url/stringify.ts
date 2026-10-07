// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

// Characters valid in a query that URLSearchParams.toString() escapes anyway.
const READABLE = /%(3A|2C|3B|40|2F)/gi;

const encode = (value: string) =>
  encodeURIComponent(value)
    .replace(/%20/g, "+")
    .replace(READABLE, (escaped) => decodeURIComponent(escaped));

/** Like URLSearchParams.toString(), but keeps `:` `,` `;` `@` `/` readable in the address bar. */
export const stringifySearch = (params: URLSearchParams): string => {
  const parts: string[] = [];
  params.forEach((value, key) => parts.push(`${encode(key)}=${encode(value)}`));
  return parts.join("&");
};
