/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { IWebhook } from "@plane/types";
import { findNestedInteractive } from "@/lib/testing/nested-interactive";
import { WebhooksListItem } from "./webhooks-list-item";

vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "ws" }) }));
vi.mock("@/hooks/store/use-webhook", () => ({ useWebhook: () => ({ updateWebhook: vi.fn() }) }));

const webhook: IWebhook = {
  id: "w1",
  url: "https://example.com/hook",
  is_active: true,
  created_at: "",
  updated_at: "",
  cycle: false,
  issue: true,
  issue_comment: false,
  module: false,
  project: false,
};

describe("WebhooksListItem", () => {
  it("keeps the toggle outside the row link", () => {
    const { container } = render(
      <MemoryRouter>
        <WebhooksListItem webhook={webhook} />
      </MemoryRouter>
    );
    expect(findNestedInteractive(container)).toEqual([]);
    expect(screen.getByRole("link", { name: webhook.url }).getAttribute("href")).toBe("/ws/settings/webhooks/w1/");
    expect(screen.getByRole("switch", { name: "Toggle webhook" }).closest("a")).toBeNull();
  });
});
