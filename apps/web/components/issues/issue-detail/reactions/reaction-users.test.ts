// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { TIssueReaction } from "@plane/types";
import { getReactionUserNames } from "./reaction-users";

const actor = (id: string, display_name: string): Pick<TIssueReaction, "actor" | "actor_detail"> => ({
  actor: id,
  actor_detail: { id, display_name, first_name: "", last_name: "", avatar: "", avatar_url: null, is_bot: false },
});

describe("getReactionUserNames", () => {
  const reactions: Record<string, Pick<TIssueReaction, "actor" | "actor_detail">> = {
    r1: actor("u1", "Ana"),
    r2: actor("u2", "Former"),
  };
  const members: Record<string, string> = { u1: "Ana Member" };

  it("prefers the member name and falls back to the reaction actor", () => {
    expect(
      getReactionUserNames(
        ["r1", "r2", "missing"],
        (id) => reactions[id],
        (id) => members[id]
      )
    ).toEqual(["Ana Member", "Former"]);
  });
});
