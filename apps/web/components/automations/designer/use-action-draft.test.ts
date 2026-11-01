/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TAutomationActionConfig } from "@plane/types";
import { useActionDraft } from "./use-action-draft";

const rejectEmptyComment = (config: TAutomationActionConfig) =>
  "comment_html" in config && config.comment_html
    ? Promise.resolve("action-1")
    : Promise.reject(new Error("The comment body is empty."));

const setup = (savedId?: string, savedConfig?: TAutomationActionConfig) => {
  const create = vi.fn(rejectEmptyComment);
  const update = vi.fn((_id: string, _config: TAutomationActionConfig) => Promise.resolve());
  const hook = renderHook(() =>
    useActionDraft({
      savedId,
      savedConfig,
      initialConfig: { comment_html: "" },
      create,
      update,
      describeError: (error) => (error instanceof Error ? error.message : "unknown"),
    })
  );
  return { create, update, hook };
};

describe("useActionDraft", () => {
  it("does not create an action for the empty starting config", () => {
    const { create, hook } = setup();
    expect(create).not.toHaveBeenCalled();
    expect(hook.result.current.config).toEqual({ comment_html: "" });
  });

  it("keeps a rejected config on screen with the reason", async () => {
    const { create, hook } = setup();
    await act(async () => {
      expect(await hook.result.current.change({ comment_html: "" })).toBe(false);
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(hook.result.current.error).toBe("The comment body is empty.");
    expect(hook.result.current.config).toEqual({ comment_html: "" });
  });

  it("creates the action once the config is valid and updates it afterwards", async () => {
    const { create, update, hook } = setup();
    await act(async () => {
      await hook.result.current.change({ comment_html: "<p>Hi</p>" });
    });
    expect(create).toHaveBeenCalledExactlyOnceWith({ comment_html: "<p>Hi</p>" });
    expect(hook.result.current.error).toBeNull();

    await act(async () => {
      await hook.result.current.change({ comment_html: "<p>Hello</p>" });
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledExactlyOnceWith("action-1", { comment_html: "<p>Hello</p>" });
  });

  it("does not create twice when a second edit arrives during the create", async () => {
    const { create, update, hook } = setup();
    await act(async () => {
      const first = hook.result.current.change({ comment_html: "<p>a</p>" });
      const second = hook.result.current.change({ comment_html: "<p>ab</p>" });
      await Promise.all([first, second]);
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledExactlyOnceWith("action-1", { comment_html: "<p>ab</p>" });
  });

  it("holds an invalid edit of a stored action instead of reverting it", async () => {
    const { update, hook } = setup("action-1", { property: "state", change_type: "set", value: "s1" });
    update.mockRejectedValueOnce(new Error("Pick a value for the property you're changing."));
    const edit: TAutomationActionConfig = { property: "priority", change_type: "set" };
    await act(async () => {
      await hook.result.current.change(edit);
    });
    expect(hook.result.current.config).toEqual(edit);
    expect(hook.result.current.error).toBe("Pick a value for the property you're changing.");
  });

  it("settles to the id of a create that is still in flight", async () => {
    const { hook } = setup();
    let settled: Promise<string | undefined> = Promise.resolve(undefined);
    await act(async () => {
      const saving = hook.result.current.change({ comment_html: "<p>a</p>" });
      settled = hook.result.current.settle();
      await saving;
    });
    await expect(settled).resolves.toBe("action-1");
  });
});
