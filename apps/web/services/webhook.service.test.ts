// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import type { ApiSchema } from "@plane/api-types";
import { toWebhook, toWebhookCreateBody } from "./webhook.service";

vi.mock("@/services/api-client", () => ({ apiClient: {} }));

const row: ApiSchema<"WebhookWithoutSecret"> = {
  id: "h1",
  url: "https://hooks.example/x",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
  is_active: true,
  project: true,
  issue: false,
  module: false,
  cycle: false,
  issue_comment: false,
  is_internal: false,
  version: "v1",
  created_by: null,
  updated_by: null,
  workspace: "w1",
};

describe("toWebhook", () => {
  it("keeps the secret key only when it is sent", () => {
    expect("secret_key" in toWebhook(row)).toBe(false);
    expect(toWebhook({ ...row, secret_key: "s" }).secret_key).toBe("s");
  });
});

describe("toWebhookCreateBody", () => {
  it("drops the fields the endpoint does not accept", () => {
    const body = toWebhookCreateBody({ ...toWebhook({ ...row, secret_key: "s" }), url: "https://a.example" });
    expect(body).toEqual({
      url: "https://a.example",
      is_active: true,
      project: true,
      issue: false,
      module: false,
      cycle: false,
      issue_comment: false,
    });
  });
});
