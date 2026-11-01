// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import {
  findLiteral,
  isNumberArray,
  isObject,
  isOneOf,
  isRecord,
  isStringArray,
  readBoolean,
  readField,
  readNumber,
  readString,
} from "./narrow";

describe("isRecord", () => {
  it("accepts objects", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord(Object.create(null))).toBe(true);
  });

  it("rejects arrays, null and primitives", () => {
    for (const value of [[], [1], null, undefined, "a", 1, true, () => 1]) expect(isRecord(value)).toBe(false);
  });
});

describe("isObject", () => {
  it("accepts objects and arrays", () => {
    expect(isObject({})).toBe(true);
    expect(isObject([])).toBe(true);
  });

  it("rejects null and primitives", () => {
    for (const value of [null, undefined, "a", 1, true, () => 1]) expect(isObject(value)).toBe(false);
  });
});

describe("isOneOf", () => {
  const VALUES = ["a", "b"] as const;

  it("matches members with strict equality", () => {
    expect(isOneOf(VALUES, "a")).toBe(true);
    expect(isOneOf(VALUES, "c")).toBe(false);
    expect(isOneOf([1, 2], "1")).toBe(false);
    expect(isOneOf(VALUES, undefined)).toBe(false);
  });
});

describe("findLiteral", () => {
  it("returns the matching member or undefined", () => {
    expect(findLiteral(["a", "b"], "b")).toBe("b");
    expect(findLiteral(["a", "b"], "c")).toBeUndefined();
    expect(findLiteral(["a", "b"], 1)).toBeUndefined();
  });
});

describe("isStringArray", () => {
  it("accepts arrays of strings, including empty strings and empty arrays", () => {
    expect(isStringArray([])).toBe(true);
    expect(isStringArray(["", "a"])).toBe(true);
  });

  it("rejects mixed arrays and non-arrays", () => {
    expect(isStringArray(["a", 1])).toBe(false);
    expect(isStringArray("a")).toBe(false);
    expect(isStringArray({ 0: "a", length: 1 })).toBe(false);
  });
});

describe("isNumberArray", () => {
  it("accepts arrays of numbers", () => {
    expect(isNumberArray([])).toBe(true);
    expect(isNumberArray([0, 1.5])).toBe(true);
  });

  it("rejects mixed arrays and non-arrays", () => {
    expect(isNumberArray([1, "2"])).toBe(false);
    expect(isNumberArray(1)).toBe(false);
  });
});

describe("field readers", () => {
  const value = { text: "", count: 0, flag: false, nested: { a: 1 } };

  it("read fields of records", () => {
    expect(readField(value, "nested")).toEqual({ a: 1 });
    expect(readString(value, "text")).toBe("");
    expect(readNumber(value, "count")).toBe(0);
    expect(readBoolean(value, "flag")).toBe(false);
  });

  it("return undefined for a field of another type", () => {
    expect(readString(value, "count")).toBeUndefined();
    expect(readNumber(value, "text")).toBeUndefined();
    expect(readBoolean(value, "count")).toBeUndefined();
    expect(readField(value, "missing")).toBeUndefined();
  });

  it("return undefined for values that are not records", () => {
    expect(readField(null, "a")).toBeUndefined();
    expect(readString("abc", "length")).toBeUndefined();
    expect(readNumber(["a"], "length")).toBeUndefined();
  });
});
