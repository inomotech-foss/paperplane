/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IPartialProject, TProjectSettingsItem, TProjectSettingsTabs } from "@plane/types";

type TWorkItemsFlag = Pick<IPartialProject, "issue_view"> | undefined | null;

// Settings that only make sense while the project has work items enabled.
export const WORK_ITEM_DEPENDENT_SETTINGS: ReadonlySet<TProjectSettingsTabs> = new Set<TProjectSettingsTabs>([
  "features_cycles",
  "features_modules",
  "features_views",
  "features_intake",
  "states",
  "labels",
  "custom-fields",
  "work-item-types",
  "estimates",
  "automations",
  "service-desk",
]);

// Unknown projects count as enabled, matching the model default.
export const isWorkItemsEnabled = (project: TWorkItemsFlag): boolean => project?.issue_view !== false;

export const isProjectSettingVisible = (key: TProjectSettingsTabs, project: TWorkItemsFlag): boolean =>
  isWorkItemsEnabled(project) || !WORK_ITEM_DEPENDENT_SETTINGS.has(key);

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
