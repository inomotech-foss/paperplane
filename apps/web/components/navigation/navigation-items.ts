/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TNavigationItem } from "@/components/navigation/tab-navigation-root";
import { getAvailableProjectFeatures, getProjectFeatureUrl } from "@/components/project/features/features";
import type { TProjectFeatureProject, TProjectRole } from "@/components/project/features/features";

export const getProjectNavigationItems = (
  workspaceSlug: string,
  projectId: string,
  project: TProjectFeatureProject,
  role: TProjectRole
): TNavigationItem[] =>
  getAvailableProjectFeatures(project, role).map((feature) => ({
    key: feature.key,
    i18n_key: feature.i18nKey,
    icon: feature.icon,
    href: getProjectFeatureUrl(feature, workspaceSlug, projectId),
  }));
