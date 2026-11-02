// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { Ref } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InboxIssueCreateModalRoot } from "./modal";

vi.mock("./create-root", () => ({
  InboxIssueCreateRoot: ({ titleRef }: { titleRef?: Ref<HTMLInputElement> }) => (
    <div>
      <button type="button">First</button>
      <input aria-label="Title" ref={titleRef} />
    </div>
  ),
}));

describe("InboxIssueCreateModalRoot", () => {
  it("focuses the title when it opens", async () => {
    render(<InboxIssueCreateModalRoot workspaceSlug="w" projectId="p" modalState handleModalClose={vi.fn()} />);
    const title = await screen.findByRole("textbox", { name: "Title" });
    await waitFor(() => expect(document.activeElement).toBe(title));
  });
});
