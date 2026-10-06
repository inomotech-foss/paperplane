// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";

import parity from "../fixtures/parity.json";
import { syntaxError } from "./parse.js";

// Regenerate with tools/export_parity.py when the Python tests change.
describe("parity with the Python parser", () => {
  it.each(parity.valid)("accepts %s", (query) => {
    expect(syntaxError(query)).toBeNull();
  });

  it.each(parity.invalid)("rejects $query at $position", ({ query, position, token, detail, expected }) => {
    expect(syntaxError(query)).toEqual({
      position,
      token,
      detail,
      expected,
      message: expected ? `${detail}; expected ${expected}` : detail,
    });
  });

  it.each(parity.semantic)("leaves %s to the validate endpoint", (query) => {
    expect(syntaxError(query)).toBeNull();
  });
});
