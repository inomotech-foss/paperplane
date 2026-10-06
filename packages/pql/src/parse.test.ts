// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";

import { highlightTokens } from "./highlight.js";
import { syntaxError, tokenName, tokenize } from "./parse.js";

const kinds = (source: string) => tokenize(source).map((token) => `${tokenName(token.type)}:${token.text ?? ""}`);

describe("tokenize", () => {
  it("lexes keywords, operators, literals and durations", () => {
    expect(kinds('state = "Done" and priority in (urgent, high) and due_date < now() - 2d')).toEqual([
      "IDENT:state",
      "EQ:=",
      'STRING:"Done"',
      "AND:and",
      "IDENT:priority",
      "IN:in",
      "LPAREN:(",
      "IDENT:urgent",
      "COMMA:,",
      "IDENT:high",
      "RPAREN:)",
      "AND:and",
      "IDENT:due_date",
      "LT:<",
      "NOW:now",
      "LPAREN:(",
      "RPAREN:)",
      "MINUS:-",
      "DURATION:2d",
      "EOF:<EOF>",
    ]);
  });

  it("is case-insensitive for keywords and function names", () => {
    expect(kinds("NOT CurrentUser()").slice(0, 2)).toEqual(["NOT:NOT", "CURRENTUSER:CurrentUser"]);
  });

  it("keeps Unicode identifiers whole and skips Unicode whitespace", () => {
    expect(kinds("priority = ürgent")).toEqual(["IDENT:priority", "EQ:=", "IDENT:ürgent", "EOF:<EOF>"]);
  });

  it("records character offsets", () => {
    const [field, operator, value] = tokenize("priority = urgent");
    expect([field!.start, field!.stop + 1]).toEqual([0, 8]);
    expect([operator!.start, operator!.stop + 1]).toEqual([9, 10]);
    expect([value!.start, value!.stop + 1]).toEqual([11, 17]);
  });
});

describe("syntaxError", () => {
  it("accepts a valid query", () => {
    expect(syntaxError('priority = "urgent" AND assignee = currentUser()')).toBeNull();
  });

  it("points at the offending token and lists the expected tokens", () => {
    const error = syntaxError("priority urgent");
    expect(error).toMatchObject({ position: 9, token: "urgent" });
    expect(error?.message).toContain("'='");
    expect(error?.message).toContain("'in'");
  });

  it("reports an unterminated string at its opening quote", () => {
    expect(syntaxError('priority = "urgent')).toMatchObject({ position: 11, message: "unterminated string literal" });
  });

  it("reports an empty query", () => {
    expect(syntaxError("   ")).toMatchObject({ position: 3, token: null, message: "empty query" });
  });

  it("reports the end of input", () => {
    expect(syntaxError("priority =")).toMatchObject({ position: 10, token: null });
    expect(syntaxError("priority =")?.message).toMatch(/^unexpected end of input; expected one of /);
  });
});

describe("highlightTokens", () => {
  it("tells field identifiers from bare values", () => {
    const tagged = highlightTokens("priority = urgent and state in (a, b)");
    const byText = Object.fromEntries(tagged.map(({ token, tag }) => [token.text, tag.toString()]));
    expect(byText["priority"]).toBe(byText["state"]);
    expect(byText["urgent"]).toBe(byText["a"]);
    expect(byText["priority"]).not.toBe(byText["urgent"]);
    expect(byText["and"]).toBe(byText["in"]);
  });

  it("tags an incomplete query while it is typed", () => {
    expect(highlightTokens("priority =").map(({ token }) => token.text)).toEqual(["priority", "="]);
  });
});
