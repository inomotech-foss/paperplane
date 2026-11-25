// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = (file: string) => readFileSync(path.resolve(__dirname, file), "utf8");

describe("editor colour fallbacks", () => {
  it.each(["../styles/globals.css", "../../space/styles/globals.css"])(
    "%s does not outrank the editor's dark theme colours",
    (file) => {
      // A plain :root ties with [data-theme*="dark"] and, being later, wins.
      const fallback = /([^{}]*)\{[^}]*--editor-colors-orange-background/.exec(css(file));

      expect(fallback?.[1].trim().split("\n").pop()?.trim()).toBe(":where(:root)");
    }
  );
});
