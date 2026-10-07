// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { TProjectFeature, TProjectFeatureProject, TProjectRole } from "./features";
import { getAvailableProjectFeatures } from "./features";

// Null means no feature is available to this user.
export const resolveProjectLanding = (
  project: TProjectFeatureProject,
  role: TProjectRole,
  preferredTabKey: string | null | undefined
): TProjectFeature | null => {
  const available = getAvailableProjectFeatures(project, role);
  return available.find((feature) => feature.key === preferredTabKey) ?? available[0] ?? null;
};
