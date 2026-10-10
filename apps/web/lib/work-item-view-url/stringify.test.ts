// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { normalizeSearch, stringifySearch } from "./stringify";

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

  it.each(["a+b", "a&b=c", "50%", "x#y", "a?b", "ü", " lead", "a;b:c,d/e@f", "it's", "a!b*(c)~"])(
    "round trips %j in the form the browser keeps",
    (value) => {
      const search = `?${stringifySearch(new URLSearchParams([["q", value]]))}`;
      expect(new URLSearchParams(search).get("q")).toBe(value);
      expect(new URL(search, "http://localhost").search).toBe(search);
    }
  );
});

describe("normalizeSearch", () => {
  it("gives differently escaped forms of a search the same value", () => {
    expect(normalizeSearch("?q=priority+%3D+'high'")).toBe(normalizeSearch("?q=priority+%3D+%27high%27"));
    expect(normalizeSearch("l=list")).toBe("?l=list");
    expect(normalizeSearch("")).toBe("");
  });
});
