// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

export type TResolvedProjectLink = { kind: "internal"; href: string } | { kind: "external"; href: string };

export const MAX_PROJECT_LINK_URL_LENGTH = 2048;

// Mirrored in apps/api/plane/app/serializers/project_link.py; keep both in sync.
const ABSOLUTE_URL = /^https?:\/\/(?:[^/?#@]*@)?(?:\[[0-9a-f:.]+\]|[^/?#@:[\]]+)(?::[0-9]{1,5})?(?:[/?#].*)?$/i;
// Whitespace, control characters and backslashes are reinterpreted by browsers.
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[\s\u0000-\u001f\u007f\\]/;

/** http(s) URLs with a host, or paths starting with a single "/". */
export const isValidProjectLinkUrl = (rawUrl: string): boolean => {
  const url = rawUrl.trim();
  if (!url || url.length > MAX_PROJECT_LINK_URL_LENGTH || FORBIDDEN.test(url)) return false;
  if (url.startsWith("/")) return !url.startsWith("//");
  return ABSOLUTE_URL.test(url);
};

/** First message of a DRF error body such as {"url": ["..."]} or {"error": "..."}. */
export const getProjectLinkErrorMessage = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") return undefined;
  for (const value of Object.values(error)) {
    const message: unknown = Array.isArray(value) ? value[0] : value;
    if (typeof message === "string" && message) return message;
  }
  return undefined;
};

const isSafeInternalHref = (href: string) => href.startsWith("/") && !href.startsWith("//") && !href.includes("\\");

/** Same-origin URLs under "/<workspaceSlug>/" route in-app; null means "do not render". */
export const resolveProjectLink = (
  url: string,
  appOrigin: string,
  workspaceSlugs: ReadonlySet<string>
): TResolvedProjectLink | null => {
  if (!isValidProjectLinkUrl(url)) return null;
  let parsed: URL;
  try {
    parsed = new URL(url.trim(), appOrigin);
  } catch {
    return null;
  }
  if (parsed.origin === appOrigin) {
    const href = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    const slug = parsed.pathname.split("/")[1] ?? "";
    if (isSafeInternalHref(href) && workspaceSlugs.has(slug) && parsed.pathname.startsWith(`/${slug}/`))
      return { kind: "internal", href };
  }
  return { kind: "external", href: parsed.href };
};
