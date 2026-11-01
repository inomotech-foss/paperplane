// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TAutomationActionConfig } from "@plane/types";
import { useRefusedActionEdits } from "./use-refused-action-edits";

const refusal = { config: ["The comment body is empty."] };

const setup = (initiallyEnabled: boolean) => {
  const state = { enabled: initiallyEnabled };
  const save = vi.fn<(actionId: string, config: TAutomationActionConfig) => Promise<unknown>>();
  const { result } = renderHook(() =>
    useRefusedActionEdits({
      save,
      isEnabled: () => state.enabled,
      describeError: () => "The comment body is empty.",
    })
  );
  return { result, save, state };
};

describe("useRefusedActionEdits", () => {
  it("keeps a refused edit while the automation is enabled", async () => {
    const { result, save } = setup(true);
    save.mockRejectedValueOnce(refusal);

    await act(async () => {
      expect(await result.current.saveConfig("a1", { comment_html: "" })).toBe(false);
    });

    expect(result.current.refusals).toEqual({
      a1: { config: { comment_html: "" }, message: "The comment body is empty." },
    });
  });

  it("saves the refused edits again once the automation is disabled", async () => {
    const { result, save, state } = setup(true);
    save.mockRejectedValueOnce(refusal).mockResolvedValueOnce(undefined);
    await act(async () => {
      await result.current.saveConfig("a1", { comment_html: "" });
    });

    state.enabled = false;
    await act(async () => {
      result.current.resubmitAll();
    });

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith("a1", { comment_html: "" });
    expect(result.current.refusals).toEqual({});
  });

  it("saves again when the refusal arrives after the automation was disabled", async () => {
    const { result, save, state } = setup(true);
    let rejectSave: ((error: unknown) => void) | undefined;
    save
      .mockReturnValueOnce(
        new Promise((_resolve, reject) => {
          rejectSave = reject;
        })
      )
      .mockResolvedValueOnce(undefined);

    let saved: Promise<boolean> | undefined;
    act(() => {
      saved = result.current.saveConfig("a1", { comment_html: "" });
    });
    state.enabled = false;
    await act(async () => {
      rejectSave?.(refusal);
      expect(await saved).toBe(true);
    });

    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.refusals).toEqual({});
  });

  it("keeps the refusal when the draft save fails too", async () => {
    const { result, save } = setup(false);
    save.mockRejectedValue(refusal);

    await act(async () => {
      expect(await result.current.saveConfig("a1", { comment_html: "" })).toBe(false);
    });

    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.refusals.a1?.message).toBe("The comment body is empty.");
  });

  it("ignores a refusal of an edit that a newer edit replaced", async () => {
    const { result, save } = setup(true);
    let rejectFirst: ((error: unknown) => void) | undefined;
    save
      .mockReturnValueOnce(
        new Promise((_resolve, reject) => {
          rejectFirst = reject;
        })
      )
      .mockResolvedValueOnce(undefined);

    let first: Promise<boolean> | undefined;
    act(() => {
      first = result.current.saveConfig("a1", { comment_html: "" });
    });
    await act(async () => {
      await result.current.saveConfig("a1", { comment_html: "<p>Hi</p>" });
      rejectFirst?.(refusal);
      await first;
    });

    expect(result.current.refusals).toEqual({});
  });
});
