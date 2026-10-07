// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { ElementType } from "react";
import { EUserPermissions } from "@plane/constants";
import {
  CyclesOutline,
  IntakeOutline,
  ModuleOutline,
  PagesOutline,
  ViewsOutline,
  WorkItemsOutline,
} from "@makeplane/propel/icons";
import type { EUserProjectRoles, IPartialProject, TProjectSettingsTabs } from "@plane/types";

export type TProjectFeatureKey = "work_items" | "cycles" | "modules" | "views" | "pages" | "intake";

export type TProjectFeatureFlag =
  | "issue_view"
  | "cycle_view"
  | "module_view"
  | "issue_views_view"
  | "page_view"
  | "inbox_view";

export type TProjectFeatureProject = Pick<IPartialProject, TProjectFeatureFlag>;

export type TProjectRole = EUserPermissions | EUserProjectRoles | undefined | null;

export type TProjectFeature = {
  key: TProjectFeatureKey;
  i18nKey: string;
  icon: ElementType;
  // Project field that switches the feature on.
  flag: TProjectFeatureFlag;
  settingsKey: Extract<TProjectSettingsTabs, `features_${string}`>;
  needsWorkItems: boolean;
  access: EUserPermissions[];
  path: string;
};

const ALL_ROLES = [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.GUEST];
const MEMBER_ROLES = [EUserPermissions.ADMIN, EUserPermissions.MEMBER];

// Array order is the sidebar and tab order.
export const PROJECT_FEATURES: readonly TProjectFeature[] = [
  {
    key: "work_items",
    i18nKey: "sidebar.work_items",
    icon: WorkItemsOutline,
    flag: "issue_view",
    settingsKey: "features_work_items",
    needsWorkItems: false,
    access: ALL_ROLES,
    path: "issues",
  },
  {
    key: "cycles",
    i18nKey: "sidebar.cycles",
    icon: CyclesOutline,
    flag: "cycle_view",
    settingsKey: "features_cycles",
    needsWorkItems: true,
    access: MEMBER_ROLES,
    path: "cycles",
  },
  {
    key: "modules",
    i18nKey: "sidebar.modules",
    icon: ModuleOutline,
    flag: "module_view",
    settingsKey: "features_modules",
    needsWorkItems: true,
    access: MEMBER_ROLES,
    path: "modules",
  },
  {
    key: "views",
    i18nKey: "sidebar.views",
    icon: ViewsOutline,
    flag: "issue_views_view",
    settingsKey: "features_views",
    needsWorkItems: true,
    access: ALL_ROLES,
    path: "views",
  },
  {
    key: "pages",
    i18nKey: "sidebar.pages",
    icon: PagesOutline,
    flag: "page_view",
    settingsKey: "features_pages",
    needsWorkItems: false,
    access: ALL_ROLES,
    path: "pages",
  },
  {
    key: "intake",
    i18nKey: "sidebar.intake",
    icon: IntakeOutline,
    flag: "inbox_view",
    settingsKey: "features_intake",
    needsWorkItems: true,
    access: ALL_ROLES,
    path: "intake",
  },
];

export const getProjectFeature = (key: TProjectFeatureKey): TProjectFeature => {
  const feature = PROJECT_FEATURES.find((item) => item.key === key);
  if (!feature) throw new Error(`Unknown project feature: ${key}`);
  return feature;
};

export const getProjectUrl = (workspaceSlug: string, projectId: string): string =>
  `/${workspaceSlug}/projects/${projectId}`;

export const getProjectFeatureUrl = (feature: TProjectFeature, workspaceSlug: string, projectId: string): string =>
  `/${workspaceSlug}/projects/${projectId}/${feature.path}`;

export const isProjectFeatureEnabled = (feature: TProjectFeature, project: TProjectFeatureProject): boolean =>
  !!project[feature.flag] && (!feature.needsWorkItems || !!project.issue_view);

// Roles can arrive as strings from the API.
export const isProjectFeatureAllowed = (feature: TProjectFeature, role: TProjectRole): boolean =>
  !!role && feature.access.includes(Number(role));

export const isProjectFeatureAvailable = (
  feature: TProjectFeature,
  project: TProjectFeatureProject,
  role: TProjectRole
): boolean => isProjectFeatureEnabled(feature, project) && isProjectFeatureAllowed(feature, role);

export const getAvailableProjectFeatures = (project: TProjectFeatureProject, role: TProjectRole): TProjectFeature[] =>
  PROJECT_FEATURES.filter((feature) => isProjectFeatureAvailable(feature, project, role));
