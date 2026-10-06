/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { usePathname } from "next/navigation";
// plane imports
import { PROJECT_SETTINGS_FLAT_MAP } from "@plane/constants";
// components
import { ProjectWorkItemsGuard } from "@/components/project/work-items-guard";
// local imports
import { findProjectSetting, needsWorkItems } from "./work-items-dependency";

type Props = {
  workspaceSlug: string;
  projectId: string;
  children: React.ReactNode;
};

export const ProjectSettingsWorkItemsGuard = observer(function ProjectSettingsWorkItemsGuard(props: Props) {
  const { workspaceSlug, projectId, children } = props;
  const pathname = usePathname();
  const activeSetting = findProjectSetting(
    PROJECT_SETTINGS_FLAT_MAP,
    pathname,
    `/${workspaceSlug}/settings/projects/${projectId}`
  );

  if (!activeSetting || !needsWorkItems(activeSetting.key)) return <>{children}</>;
  return <ProjectWorkItemsGuard>{children}</ProjectWorkItemsGuard>;
});
