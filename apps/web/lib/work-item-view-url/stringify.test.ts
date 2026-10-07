// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { stringifySearch } from "./stringify";

describe("stringifySearch", () => {
  it("keeps filter punctuation readable", () => {
    const params = new URLSearchParams([
      ["l", "list"],
      ["f", "state:in:a,b;!priority:in:urgent"],
      ["p", "-labels,cp.x"],
    ]);
    expect(stringifySearch(params)).toBe("l=list&f=state:in:a,b;!priority:in:urgent&p=-labels,cp.x");
  });

  it("writes spaces as plus", () => {
    expect(stringifySearch(new URLSearchParams([["q", 'type = "Invoice"']]))).toBe("q=type+%3D+%22Invoice%22");
  });

  it.each(["a+b", "a&b=c", "50%", "x#y", "a?b", "ü", " lead", "a;b:c,d/e@f"])("round trips %j", (value) => {
    const parsed = new URLSearchParams(stringifySearch(new URLSearchParams([["q", value]])));
    expect(parsed.get("q")).toBe(value);
  });
});
