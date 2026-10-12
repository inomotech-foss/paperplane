/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { IUser } from "@plane/types";
import { findNestedInteractive } from "@/lib/testing/nested-interactive";
import { IssueReaction } from "./issue";

vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    reaction: {
      getReactionsByIssueId: () => ({ "128077": ["r1"] }),
      reactionsByUser: () => [],
      getReactionById: () => ({ actor: "u2", display_name: "Ana" }),
    },
    createReaction: vi.fn(),
    removeReaction: vi.fn(),
  }),
}));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: () => undefined }) }));

const currentUser: IUser = {
  id: "u1",
  avatar_url: "",
  display_name: "me",
  first_name: "",
  last_name: "",
  is_bot: false,
  cover_image_url: null,
  date_joined: "",
  email: "me@example.com",
  is_active: true,
  is_email_verified: true,
  is_password_autoset: false,
  is_tour_completed: true,
  mobile_number: null,
  last_workspace_id: "",
  user_timezone: "UTC",
  username: "me",
  last_login_medium: "email",
  theme: { theme: "light" },
};

describe("IssueReaction", () => {
  it("renders the reactions and the add button without nesting them in the picker trigger", () => {
    const { container } = render(
      <IssueReaction workspaceSlug="ws" projectId="p1" issueId="i1" currentUser={currentUser} />
    );
    expect(findNestedInteractive(container)).toEqual([]);
    expect(screen.getByRole("button", { name: "Add reaction" }).getAttribute("aria-haspopup")).toBe("dialog");
  });
});
