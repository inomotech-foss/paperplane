// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { EditorState } from "@codemirror/state";
import { describe, expect, it, vi } from "vitest";

import { diagnostic, diagnosticsKey, lintSource, syntaxDiagnostics, unplacedClass } from "./lint.js";
import { parseField } from "./state.js";

const stateOf = (doc: string) => EditorState.create({ doc, extensions: [parseField] });

describe("syntaxDiagnostics", () => {
  it("is empty for a blank or valid query", () => {
    expect(syntaxDiagnostics(stateOf("   "))).toEqual([]);
    expect(syntaxDiagnostics(stateOf("priority = urgent"))).toEqual([]);
  });

  it("underlines the offending token", () => {
    expect(syntaxDiagnostics(stateOf("priority urgent"))).toMatchObject([{ from: 9, to: 15, severity: "error" }]);
  });

  it("works without the shared parse field", () => {
    expect(syntaxDiagnostics(EditorState.create({ doc: "priority =" }))).toHaveLength(1);
  });
});

describe("diagnostic", () => {
  it("clamps the range to the document", () => {
    expect(diagnostic("abc", { position: 10, token: "zz", message: "m" })).toMatchObject({ from: 3, to: 3 });
    expect(diagnostic("abc", { position: 1, token: "bcdef", message: "m" })).toMatchObject({ from: 1, to: 3 });
  });

  it("spans the query without an underline when the error has no position", () => {
    for (const position of [null, undefined]) {
      expect(diagnostic("abc", { position, message: "m" })).toMatchObject({
        from: 0,
        to: 3,
        message: "m",
        markClass: unplacedClass,
      });
    }
  });
});

describe("lintSource", () => {
  it("holds a syntax error back until typing pauses and skips validation", async () => {
    vi.useFakeTimers();
    const validate = vi.fn();
    const source = lintSource({ validate, syntaxDelay: 100 });
    const typing = source({ state: stateOf("priori") });
    const paused = source({ state: stateOf("priority") });
    await vi.advanceTimersByTimeAsync(99);
    let settled = false;
    void Promise.resolve(paused).then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await typing).toEqual([]);
    expect(await paused).toMatchObject([{ from: 8, to: 8 }]);
    expect(validate).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("clears at once for a valid query without a validator", () => {
    expect(lintSource({})({ state: stateOf("priority = urgent") })).toEqual([]);
  });

  it("debounces the validator and keeps only the latest run", async () => {
    vi.useFakeTimers();
    const validate = vi.fn(async () => ({ position: 0, token: "foo", message: "unknown field" }));
    const source = lintSource({ validate, validateDelay: 100 });
    const stale = source({ state: stateOf("foo = 1") });
    const fresh = source({ state: stateOf("foo = 2") });
    await vi.advanceTimersByTimeAsync(100);
    expect(validate).toHaveBeenCalledTimes(1);
    expect(await stale).toEqual([]);
    expect(await fresh).toMatchObject([{ from: 0, to: 3, message: "unknown field" }]);
    vi.useRealTimers();
  });

  it("is empty for a valid query when the validator accepts it", async () => {
    vi.useFakeTimers();
    const result = lintSource({ validate: async () => null, validateDelay: 10 })({
      state: stateOf("priority = urgent"),
    });
    await vi.advanceTimersByTimeAsync(10);
    expect(await result).toEqual([]);
    vi.useRealTimers();
  });
});

describe("diagnosticsKey", () => {
  it("ignores everything but range and message", () => {
    const a = diagnostic("priority", { position: 0, token: "priority", message: "m" });
    expect(diagnosticsKey([a])).toBe(diagnosticsKey([{ ...a, source: "other" }]));
    expect(diagnosticsKey([a])).not.toBe(diagnosticsKey([{ ...a, message: "n" }]));
    expect(diagnosticsKey([])).not.toBe(diagnosticsKey([a]));
  });
});
