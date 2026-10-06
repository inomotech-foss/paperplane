// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { isValidProjectLinkUrl, resolveProjectLink } from "./project-link-url";

const ORIGIN = "https://plane.example.com";

describe("resolveProjectLink", () => {
  it("keeps relative paths in-app", () => {
    expect(resolveProjectLink("/ws/projects/p/pages/x", ORIGIN)).toEqual({
      kind: "internal",
      href: "/ws/projects/p/pages/x",
    });
  });

  it("turns same-origin absolute URLs into in-app paths", () => {
    expect(resolveProjectLink("https://plane.example.com/ws/pages/x?a=1#h", ORIGIN)).toEqual({
      kind: "internal",
      href: "/ws/pages/x?a=1#h",
    });
  });

  it("treats other origins as external", () => {
    expect(resolveProjectLink("https://github.com/o/r", ORIGIN)).toEqual({
      kind: "external",
      href: "https://github.com/o/r",
    });
  });

  it.each([
    "http://plane.example.com/ws",
    "https://plane.example.com:8443/ws",
    "https://evil.plane.example.com/ws",
    "https://plane.example.com.evil.com/ws",
  ])("treats %s as another origin", (url) => {
    expect(resolveProjectLink(url, ORIGIN)?.kind).toBe("external");
  });

  it.each([
    "javascript:alert(1)",
    " JavaScript:alert(1)",
    "data:text/html,x",
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "ftp://example.com",
    "example.com",
    "",
  ])("rejects %j", (url) => {
    expect(resolveProjectLink(url, ORIGIN)).toBeNull();
    expect(isValidProjectLinkUrl(url)).toBe(false);
  });
});
