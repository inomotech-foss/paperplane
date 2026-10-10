// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import type { IUser } from "@plane/types";
import { EIssueLayoutTypes, EStartOfTheWeek } from "@plane/types";
import { store } from "@/lib/store-context";
import { ProjectService } from "@/services/project";
import { UserService } from "@/services/user.service";
import { WorkspaceService } from "@/services/workspace.service";
import { getProjectWorkItemsBinding } from "./bindings";
import { loadViewRoute } from "./route";

const USER: IUser = {
  id: "u1",
  avatar_url: "",
  display_name: "u1",
  first_name: "",
  last_name: "",
  is_bot: false,
  cover_image_url: null,
  date_joined: "",
  email: "u1@example.com",
  is_active: true,
  is_email_verified: true,
  is_password_autoset: false,
  is_tour_completed: true,
  mobile_number: null,
  last_workspace_id: "",
  user_timezone: "UTC",
  username: "u1",
  last_login_medium: "email",
  theme: { theme: undefined },
};

describe("project work items binding", () => {
  it("makes one profile request on a cold load, for the loader and the app shell", async () => {
    const profile = { ...store.user.userProfile.data, id: "pr1", start_of_the_week: EStartOfTheWeek.MONDAY };
    const getProfile = vi
      .spyOn(UserService.prototype, "getCurrentUserProfile")
      .mockResolvedValue({ ...profile, language: "" });
    vi.spyOn(UserService.prototype, "currentUser").mockResolvedValue(USER);
    vi.spyOn(ProjectService.prototype, "getProjectUserProperties").mockResolvedValue({
      rich_filters: {},
      display_filters: { layout: EIssueLayoutTypes.LIST },
      display_properties: {},
      sort_order: 0,
      preferences: { pages: { block_display: false }, navigation: { default_tab: "", hide_in_more_menu: [] } },
    });
    vi.spyOn(UserService.prototype, "currentUserSettings").mockResolvedValue({
      id: "s1",
      email: USER.email,
      workspace: { ...store.user.userSettings.data.workspace },
    });
    vi.spyOn(WorkspaceService.prototype, "userWorkspaces").mockResolvedValue([]);

    // the route loader runs before the authentication wrapper mounts
    const data = await loadViewRoute(
      new Request("http://localhost/ws/projects/p1/issues?l=list"),
      getProjectWorkItemsBinding("ws", "p1")
    );
    expect(data.clock.weekStart).toBe(EStartOfTheWeek.MONDAY);
    await store.user.fetchCurrentUser();

    expect(getProfile).toHaveBeenCalledOnce();
    expect(store.user.userProfile.data.id).toBe("pr1");
  });
});
