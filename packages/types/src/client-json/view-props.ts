// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { z } from "zod";
import { displayFiltersSchema, displayPropertiesSchema, filterExpressionSchema } from "./issue-filters";
import { parseClientObject } from "./parse";

/** The layout a member last used, stored on the membership as `view_props` and `default_props`. */
export const workspaceViewPropsSchema = z.object({
  rich_filters: filterExpressionSchema.optional().default({}),
  display_filters: displayFiltersSchema.optional(),
  display_properties: displayPropertiesSchema.optional().default({}),
});

export type IWorkspaceViewProps = z.infer<typeof workspaceViewPropsSchema>;

export const DEFAULT_WORKSPACE_VIEW_PROPS: IWorkspaceViewProps = { rich_filters: {}, display_properties: {} };

export const parseWorkspaceViewProps = (value: unknown): IWorkspaceViewProps =>
  parseClientObject("view_props", workspaceViewPropsSchema.shape, value, DEFAULT_WORKSPACE_VIEW_PROPS);

export const projectMemberNavigationPreferencesSchema = z.object({
  default_tab: z.string(),
  hide_in_more_menu: z.array(z.string()),
});

export type IProjectMemberNavigationPreferences = z.infer<typeof projectMemberNavigationPreferencesSchema>;

export const projectUserPreferencesSchema = z.object({
  pages: z.object({ block_display: z.boolean() }).optional().default({ block_display: true }),
  navigation: projectMemberNavigationPreferencesSchema
    .optional()
    .default({ default_tab: "work_items", hide_in_more_menu: [] }),
  work_items: z.object({ last_type_id: z.string().optional() }).optional(),
});

export type TProjectUserPreferences = z.infer<typeof projectUserPreferencesSchema>;

export const DEFAULT_PROJECT_USER_PREFERENCES: TProjectUserPreferences = {
  pages: { block_display: true },
  navigation: { default_tab: "work_items", hide_in_more_menu: [] },
};

export const parseProjectUserPreferences = (value: unknown): TProjectUserPreferences =>
  parseClientObject("preferences", projectUserPreferencesSchema.shape, value, DEFAULT_PROJECT_USER_PREFERENCES);
