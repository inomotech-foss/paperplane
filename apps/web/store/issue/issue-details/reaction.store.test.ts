// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import type { TIssueCommentReaction, TIssueReaction } from "@plane/types";
import { IssueCommentReactionStore } from "./comment_reaction.store";
import { IssueReactionStore } from "./reaction.store";

vi.mock("@/services/issue", () => ({
  IssueReactionService: class {
    deleteIssueReaction = vi.fn(() => Promise.resolve());
    deleteIssueCommentReaction = vi.fn(() => Promise.resolve());
  },
}));

const rootStore = { activity: { fetchActivities: vi.fn(() => Promise.resolve([])) } };

const user = {
  id: "u1",
  display_name: "U",
  first_name: "",
  last_name: "",
  avatar: "",
  avatar_url: null,
  is_bot: false,
};

const issueReaction: TIssueReaction = {
  id: "r1",
  actor_detail: user,
  created_at: "",
  updated_at: "",
  deleted_at: null,
  reaction: "128077",
  created_by: null,
  updated_by: null,
  project: "p1",
  workspace: "w1",
  actor: "u1",
  issue: "i1",
};

const commentReaction: TIssueCommentReaction = {
  id: "cr1",
  actor: "u1",
  comment: "c1",
  reaction: "128077",
  display_name: "U",
  deleted_at: null,
  workspace: "w1",
  project: "p1",
  created_at: "",
  updated_at: "",
  created_by: null,
  updated_by: null,
};

describe("removing a reaction", () => {
  it("drops the reaction by id from an issue", async () => {
    const store = new IssueReactionStore(rootStore);
    store.addReactions("i1", [issueReaction]);
    await store.removeReaction("ws", "p1", "i1", "128077", "u1");
    expect(store.reactionMap).toEqual({});
    expect(store.reactions).toEqual({ i1: { "128077": [] } });
  });

  it("drops the reaction by id from a comment", async () => {
    const store = new IssueCommentReactionStore();
    store.applyCommentReactions("c1", [commentReaction]);
    await store.removeCommentReaction("ws", "p1", "c1", "128077", "u1");
    expect(store.commentReactionMap).toEqual({});
  });
});
