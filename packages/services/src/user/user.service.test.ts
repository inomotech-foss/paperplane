// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import type { ApiSchema } from "@plane/api-types";
import { toUserProfile, userUpdateBody } from "./user.service";

describe("userUpdateBody", () => {
  it("keeps the writable fields and drops the read-only ones", () => {
    const body = userUpdateBody({ first_name: "A", avatar_url: "", user_timezone: "UTC", email: "a@b.c" });
    expect(JSON.parse(JSON.stringify(body))).toEqual({ first_name: "A", user_timezone: "UTC" });
  });

  it("keeps a null cover image, which clears it", () => {
    expect(userUpdateBody({ cover_image: null, cover_image_asset: null })).toMatchObject({
      cover_image: null,
      cover_image_asset: null,
    });
  });
});

describe("toUserProfile", () => {
  const profile: ApiSchema<"Profile"> = {
    id: "p1",
    onboarding_step: { profile_complete: true, workspace_create: true, workspace_invite: true, workspace_join: true },
    mobile_onboarding_step: { profile_complete: true, workspace_create: true, workspace_join: true },
    product_tour: { work_items: true, cycles: true, modules: true, intake: true, pages: true },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    theme: { theme: "dark", sidebarText: "#fff" },
    is_app_rail_docked: false,
    is_tour_completed: false,
    use_case: null,
    role: null,
    is_onboarded: true,
    last_workspace_id: null,
    billing_address_country: "INDIA",
    billing_address: null,
    has_billing_address: false,
    company_name: "",
    notification_view_mode: "full",
    is_smooth_cursor_enabled: false,
    is_mobile_onboarded: false,
    mobile_timezone_auto_set: false,
    language: "en",
    start_of_the_week: 0,
    goals: {},
    background_color: "",
    is_navigation_tour_completed: false,
    has_marketing_email_consent: false,
    is_subscribed_to_changelog: false,
    user: "u1",
  };

  it("parses the theme and keeps a null role", () => {
    expect(toUserProfile(profile)).toMatchObject({ theme: { theme: "dark" }, role: null, language: "en" });
  });

  it("falls back to an empty theme for garbage", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(toUserProfile({ ...profile, theme: { darkPalette: "yes" } }).theme).toEqual({});
    warn.mockRestore();
  });
});
