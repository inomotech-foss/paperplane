// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { extractTextFromHTML } from "@/extensions/title-update/title-utils";

describe("extractTextFromHTML", () => {
  it.each([
    ["<p>A &amp; B</p>", "A & B"],
    ["<p>&lt;b&gt;x&lt;/b&gt;</p>", "<b>x</b>"],
    ["<p>&lt;script&gt;</p>", "<script>"],
    ["<p><b>x</b></p>", "x"],
  ])("syncs %j as the title %j", (html, title) => {
    expect(extractTextFromHTML(html)).toBe(title);
  });
});
