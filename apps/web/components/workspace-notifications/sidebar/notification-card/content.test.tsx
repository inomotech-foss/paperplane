// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TNotification } from "@plane/types";
import { NotificationContent } from "./content";

vi.mock("@/components/editor/lite-text", () => ({ LiteTextEditor: () => null }));

const notification = (field: string, verb: string, newValue = "", oldValue = ""): TNotification => ({
  id: "n1",
  title: undefined,
  data: { issue_activity: { id: "a1", actor: "u1", field, verb, new_value: newValue, old_value: oldValue } },
  entity_identifier: null,
  entity_name: undefined,
  message_html: undefined,
  message: null,
  message_stripped: null,
  sender: undefined,
  receiver: undefined,
  triggered_by: "u1",
  triggered_by_details: {
    id: "u1",
    avatar_url: null,
    display_name: "Member",
    first_name: "Member",
    last_name: "",
    is_bot: false,
  },
  read_at: null,
  archived_at: null,
  snoozed_till: null,
  workspace: undefined,
  project: null,
  created_at: undefined,
  updated_at: undefined,
  created_by: null,
  updated_by: null,
});

const text = (n: TNotification) =>
  render(
    <p>
      <NotificationContent notification={n} workspaceId="w" workspaceSlug="w" projectId="p" />
    </p>
  ).container.textContent;

describe("NotificationContent", () => {
  it("names the target of a relation", () => {
    expect(text(notification("relates_to", "updated", "DEMO-3"))).toBe(
      "Member marked that this work item is related to DEMO-3."
    );
    expect(text(notification("blocked_by", "updated", "DEMO-4"))).toBe(
      "Member marked that this work item is blocked by DEMO-4."
    );
  });

  it("names the target of a removed relation", () => {
    expect(text(notification("duplicate", "deleted", "", "DEMO-5"))).toBe(
      "Member marked that this work item is no longer a duplicate of DEMO-5."
    );
  });

  it("ends without a stray space when there is no value", () => {
    expect(text(notification("archived_at", "updated", "restore"))).toBe("Member restored the work item.");
  });

  it("keeps the connector before a value", () => {
    expect(text(notification("priority", "updated", "medium"))).toBe("Member updated priority to medium.");
  });
});
