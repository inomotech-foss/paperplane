// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePageEditorRef } from "./use-page-editor-ref";

const fakeRef = () => ({ id: Math.random() });

describe("usePageEditorRef", () => {
  it("hands every new editor ref to the store", () => {
    const setEditorRef = vi.fn((_ref: { id: number } | null) => {});
    const { result } = renderHook(() => usePageEditorRef(setEditorRef));
    const first = fakeRef();
    const second = fakeRef();
    act(() => result.current.editorRefCallback(first));
    act(() => result.current.editorRefCallback(null));
    act(() => result.current.editorRefCallback(second));
    expect(setEditorRef.mock.calls).toEqual([[first], [second]]);
    expect(result.current.editorRef.current).toBe(second);
  });
});
