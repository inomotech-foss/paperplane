// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import type { CollaborationState } from "@plane/editor";
import { useUnsyncedChangesPrompt } from "./use-unsynced-changes-prompt";

const stateWith = (stage: CollaborationState["stage"], hasUnsyncedChanges: boolean): CollaborationState => ({
  stage,
  isServerSynced: stage.kind === "synced",
  isServerDisconnected: stage.kind === "disconnected",
  hasUnsyncedChanges,
});
const syncTimeout = stateWith({ kind: "disconnected", error: { type: "sync-timeout", message: "slow" } }, true);

const isUnloadBlocked = () => {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

afterEach(() => cleanup());

describe("useUnsyncedChangesPrompt", () => {
  it("asks before leaving while local edits are not synced", () => {
    renderHook(() => useUnsyncedChangesPrompt(syncTimeout));
    expect(isUnloadBlocked()).toBe(true);
  });

  it("stops asking once the edits are synced", () => {
    const { rerender } = renderHook((state: CollaborationState) => useUnsyncedChangesPrompt(state), {
      initialProps: syncTimeout,
    });
    rerender(stateWith({ kind: "synced" }, false));
    expect(isUnloadBlocked()).toBe(false);
  });

  it("does not ask without local edits", () => {
    renderHook(() => useUnsyncedChangesPrompt(stateWith({ kind: "awaiting-sync" }, false)));
    expect(isUnloadBlocked()).toBe(false);
  });

  it("leaves a stopped connection to the fallback save", () => {
    const stopped = stateWith({ kind: "disconnected", error: { type: "max-retries", message: "down" } }, true);
    renderHook(() => useUnsyncedChangesPrompt(stopped));
    expect(isUnloadBlocked()).toBe(false);
  });
});
