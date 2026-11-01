// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { AdminApiSchema } from "@plane/api-types";
import { toInstance, toInstanceConfiguration, toInstanceInfo } from "./instance-convert";

const instance: AdminApiSchema<"InstanceDetail"> = {
  id: "i1",
  workspaces_exist: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
  instance_name: "Plane",
  whitelist_emails: null,
  instance_id: "abc",
  current_version: "1",
  latest_version: null,
  edition: "PLANE_COMMUNITY",
  domain: "",
  last_checked_at: "2026-01-01T00:00:00Z",
  namespace: null,
  is_telemetry_enabled: true,
  is_support_required: true,
  is_setup_done: true,
  is_signup_screen_visited: false,
  is_verified: false,
  is_test: false,
  is_current_version_deprecated: false,
  created_by: null,
  updated_by: null,
};

describe("toInstance", () => {
  it("maps unset values to undefined and keeps workspaces_exist only when sent", () => {
    const result = toInstance(instance);
    expect(result).toMatchObject({ instance_name: "Plane", latest_version: undefined, workspaces_exist: true });
    const { workspaces_exist: _exists, ...plain } = instance;
    expect("workspaces_exist" in toInstance(plain)).toBe(false);
  });
});

describe("toInstanceInfo", () => {
  it("passes the activation flags of an unregistered instance through", () => {
    expect(toInstanceInfo({ is_activated: false, is_setup_done: false })).toEqual({
      is_activated: false,
      is_setup_done: false,
    });
  });
});

describe("toInstanceConfiguration", () => {
  it("shows an unset value as empty", () => {
    const row: AdminApiSchema<"InstanceConfiguration"> = {
      id: "c1",
      is_managed: false,
      created_at: "t",
      updated_at: "t",
      deleted_at: null,
      key: "SMTP_HOST",
      value: null,
      category: "SMTP",
      is_encrypted: false,
      created_by: null,
      updated_by: null,
    };
    expect(toInstanceConfiguration(row)).toMatchObject({ key: "SMTP_HOST", value: "" });
  });
});
