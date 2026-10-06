// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

export type TResolvedProjectLink = { kind: "internal"; href: string } | { kind: "external"; href: string };

const hasWhitespaceOrControl = (url: string) =>
  /\s/.test(url) ||
  Array.from(url).some((char) => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127;
  });

const isSafeRelativePath = (url: string) => url.startsWith("/") && !url.startsWith("//") && !url.includes("\\");

/** Mirrors the server-side check: http(s) URLs or paths starting with a single "/". */
export const isValidProjectLinkUrl = (rawUrl: string): boolean => {
  const url = rawUrl.trim();
  if (!url || url.length > 2048 || hasWhitespaceOrControl(url)) return false;
  if (url.startsWith("/")) return isSafeRelativePath(url);
  try {
    const parsed = new URL(url);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && !!parsed.hostname;
  } catch {
    return false;
  }
};

/** Returns null for URLs that must not be rendered as links. */
export const resolveProjectLink = (url: string, appOrigin: string): TResolvedProjectLink | null => {
  if (!isValidProjectLinkUrl(url)) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("/")) return { kind: "internal", href: trimmed };
  const parsed = new URL(trimmed);
  if (parsed.origin === appOrigin)
    return { kind: "internal", href: `${parsed.pathname}${parsed.search}${parsed.hash}` };
  return { kind: "external", href: parsed.href };
};
