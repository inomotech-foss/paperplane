// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiTokenListItem } from "./token-list-item";

vi.mock("@/components/api-token/delete-token-modal", () => ({ DeleteApiTokenModal: () => null }));

describe("ApiTokenListItem", () => {
  it("names the delete button", () => {
    render(
      <ApiTokenListItem
        token={{
          id: "t1",
          label: "CI",
          description: "",
          is_active: true,
          expired_at: null,
          created_at: "",
          created_by: "",
          updated_at: "",
          updated_by: "",
          last_used: null,
          token: "",
          user: "",
          user_type: 0,
          workspace: "",
        }}
      />
    );
    const button = screen.getByRole("button", { name: "Delete access token" });
    expect(button.className).not.toMatch(/\bhidden\b/);
  });
});
