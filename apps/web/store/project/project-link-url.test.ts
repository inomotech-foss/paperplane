// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { getProjectLinkErrorMessage, isValidProjectLinkUrl, resolveProjectLink } from "./project-link-url";

const ORIGIN = "https://plane.example.com";
const SLUGS = new Set(["ws", "other"]);

const resolve = (url: string) => resolveProjectLink(url, ORIGIN, SLUGS);

// Same cases as TestProjectLinkUrlValidation in apps/api/plane/tests/contract/app/test_project_links_app.py.
const ACCEPTED = [
  "https://github.com/inomotech-foss/paperplane",
  "http://example.com",
  "/ws/projects/abc/pages/def",
  "/ws/projects/abc/pages/?q=1#top",
  "http://wiki/x",
  "https://intranet:8443/a?b=c#d",
  "HTTPS://Example.com",
  "http://user:pw@wiki/",
  "http://[::1]:8000/",
];

const REJECTED = [
  "javascript:alert(1)",
  "JavaScript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "vbscript:msgbox(1)",
  "ftp://example.com/file",
  "mailto:a@example.com",
  "//evil.example.com",
  "/\\evil.example.com",
  "/\t/evil.example.com",
  "example.com",
  "relative/path",
  "",
  "   ",
  "http://",
  "http:///x",
  "http:/wiki",
  "https://user@/x",
  "http://wiki:port/",
  "http://wiki\\x",
  "http://wi ki/",
  "/a\\b",
];

describe("isValidProjectLinkUrl", () => {
  it.each(ACCEPTED)("accepts %j", (url) => {
    expect(isValidProjectLinkUrl(url)).toBe(true);
  });

  it.each(REJECTED)("rejects %j", (url) => {
    expect(isValidProjectLinkUrl(url)).toBe(false);
    expect(resolve(url)).toBeNull();
  });
});

describe("resolveProjectLink", () => {
  it("keeps workspace paths in-app", () => {
    expect(resolve("/ws/projects/p/pages/x")).toEqual({ kind: "internal", href: "/ws/projects/p/pages/x" });
  });

  it("turns same-origin workspace URLs into in-app paths", () => {
    expect(resolve("https://plane.example.com/other/pages/x?a=1#h")).toEqual({
      kind: "internal",
      href: "/other/pages/x?a=1#h",
    });
  });

  it("normalises dot segments before deciding", () => {
    expect(resolve("/ws/../api/x")).toEqual({ kind: "external", href: `${ORIGIN}/api/x` });
    expect(resolve("/api/../ws/x")).toEqual({ kind: "internal", href: "/ws/x" });
  });

  it.each(["/api/v1/x", "/god-mode/", "/spaces/x", "/uploads/a.png", "/unknown/x", "/ws", "/"])(
    "renders same-origin non-app path %j as a full URL",
    (path) => {
      expect(resolve(path)).toEqual({ kind: "external", href: new URL(path, ORIGIN).href });
      expect(resolve(`${ORIGIN}${path}`)).toEqual({ kind: "external", href: new URL(path, ORIGIN).href });
    }
  );

  it("never routes a same-origin '//' path in-app", () => {
    const resolved = resolve("https://plane.example.com//evil.com/x");

    expect(resolved?.kind).toBe("external");
    expect(resolved?.href).toBe("https://plane.example.com//evil.com/x");
  });

  it("treats other origins as external", () => {
    expect(resolve("https://github.com/o/r")).toEqual({ kind: "external", href: "https://github.com/o/r" });
  });

  it.each([
    "http://plane.example.com/ws/x",
    "https://plane.example.com:8443/ws/x",
    "https://evil.plane.example.com/ws/x",
    "https://plane.example.com.evil.com/ws/x",
  ])("treats %s as another origin", (url) => {
    expect(resolve(url)?.kind).toBe("external");
  });
});

describe("getProjectLinkErrorMessage", () => {
  it.each([
    [{ url: ["Bad URL."] }, "Bad URL."],
    [{ error: "Nope." }, "Nope."],
    [{ url: [] }, undefined],
    [undefined, undefined],
    ["text", undefined],
  ])("reads %j", (error, expected) => {
    expect(getProjectLinkErrorMessage(error)).toBe(expected);
  });
});
