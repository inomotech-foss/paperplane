/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { GROUPED_PROJECT_SETTINGS, PROJECT_SETTINGS_CATEGORY } from "@plane/constants";
import type { IPartialProject, TProjectSettingsItem, TProjectSettingsTabs } from "@plane/types";

type TWorkItemsFlag = Partial<Pick<IPartialProject, "issue_view">> | undefined | null;

export type TWorkItemsDependentFeature = "cycle_view" | "module_view" | "issue_views_view" | "inbox_view";

type TFeatureSetting = Extract<TProjectSettingsTabs, `features_${string}` | "links">;

// Features entries are decided one by one, other categories as a whole.
const CATEGORY_NEEDS_WORK_ITEMS: Record<PROJECT_SETTINGS_CATEGORY, boolean | "per-item"> = {
  [PROJECT_SETTINGS_CATEGORY.GENERAL]: false,
  [PROJECT_SETTINGS_CATEGORY.FEATURES]: "per-item",
  [PROJECT_SETTINGS_CATEGORY.WORK_STRUCTURE]: true,
  [PROJECT_SETTINGS_CATEGORY.EXECUTION]: true,
};

export const FEATURE_NEEDS_WORK_ITEMS: Record<TFeatureSetting, boolean> = {
  features_work_items: false,
  features_cycles: true,
  features_modules: true,
  features_views: true,
  features_pages: false,
  features_intake: true,
  links: false,
};

const SETTING_CATEGORY = new Map<TProjectSettingsTabs, PROJECT_SETTINGS_CATEGORY>(
  Object.values(PROJECT_SETTINGS_CATEGORY).flatMap((category) =>
    GROUPED_PROJECT_SETTINGS[category].map((item) => [item.key, category] as const)
  )
);

// Undecided Features entries count as dependent.
export const needsWorkItems = (key: TProjectSettingsTabs): boolean => {
  const category = SETTING_CATEGORY.get(key);
  if (!category) return false;
  const rule = CATEGORY_NEEDS_WORK_ITEMS[category];
  if (rule !== "per-item") return rule;
  return (FEATURE_NEEDS_WORK_ITEMS as Partial<Record<TProjectSettingsTabs, boolean>>)[key] ?? true;
};

// Unknown projects count as enabled, matching the model default.
export const isWorkItemsEnabled = (project: TWorkItemsFlag): boolean => project?.issue_view !== false;

export const isProjectFeatureEnabled = (
  project: Partial<Pick<IPartialProject, "issue_view" | TWorkItemsDependentFeature>> | undefined | null,
  feature: TWorkItemsDependentFeature
): boolean => isWorkItemsEnabled(project) && !!project?.[feature];

export const isProjectSettingVisible = (key: TProjectSettingsTabs, project: TWorkItemsFlag): boolean =>
  isWorkItemsEnabled(project) || !needsWorkItems(key);

export const filterVisibleProjectSettings = <T extends Pick<TProjectSettingsItem, "key">>(
  items: T[],
  project: TWorkItemsFlag
): T[] => items.filter((item) => isProjectSettingVisible(item.key, project));

export const findProjectSetting = <T extends Pick<TProjectSettingsItem, "highlight">>(
  items: T[],
  pathname: string,
  baseUrl: string
): T | undefined => {
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return items.find((item) => item.highlight(normalized, baseUrl));
};
