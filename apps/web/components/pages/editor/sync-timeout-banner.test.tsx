// SPDX-License-Identifier: AGPL-3.0-only

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CollaborationState } from "@plane/editor";
import { PageSyncTimeoutBanner } from "./sync-timeout-banner";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const stateWith = (stage: CollaborationState["stage"]): CollaborationState => ({
  stage,
  isServerSynced: stage.kind === "synced",
  isServerDisconnected: stage.kind === "disconnected",
  hasUnsyncedChanges: true,
});

describe("PageSyncTimeoutBanner", () => {
  it("warns that changes are not saved while a sync timeout reconnects", () => {
    render(
      <PageSyncTimeoutBanner
        collaborationState={stateWith({ kind: "disconnected", error: { type: "sync-timeout", message: "slow" } })}
      />
    );
    expect(screen.getByText("page_sync_timeout_banner.message")).toBeTruthy();
  });

  it.each([
    stateWith({ kind: "synced" }),
    stateWith({ kind: "disconnected", error: { type: "max-retries", message: "down" } }),
  ])("stays hidden otherwise", (state) => {
    const { container } = render(<PageSyncTimeoutBanner collaborationState={state} />);
    expect(container.textContent).toBe("");
  });
});
