/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useMemo } from "react";
import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { ProjectsOutline } from "@makeplane/propel/icons";
import type { TLogoProps } from "@plane/types";
import { Select } from "@plane/blocks/select";
// components
import { getProjectUrl } from "@/components/project/features/features";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useAppRouter } from "@/hooks/use-app-router";
// local imports
import { SwitcherIcon } from "../common/switcher-label";
import { ProjectHeaderButton } from "./project-header-button";

type TProjectHeaderProps = {
  workspaceSlug: string;
  projectId: string;
};

type TProjectSwitcherOption = {
  value: string;
  query: string;
  logo_props: TLogoProps | undefined;
};

export const ProjectHeader = observer(function ProjectHeader(props: TProjectHeaderProps) {
  const { workspaceSlug, projectId } = props;
  // plane hooks
  const { t } = useTranslation();
  // router
  const router = useAppRouter();
  // store hooks
  const { joinedProjectIds, getPartialProjectById } = useProject();

  // Get current project details
  const currentProjectDetails = getPartialProjectById(projectId);

  // Memoize switcher options to prevent recalculation on every render
  const switcherOptions = useMemo<TProjectSwitcherOption[]>(
    () =>
      joinedProjectIds
        .map((id): TProjectSwitcherOption | null => {
          const project = getPartialProjectById(id);
          if (!project) return null;

          return {
            value: id,
            query: project.name,
            logo_props: project.logo_props,
          };
        })
        .filter((option): option is TProjectSwitcherOption => option !== null),
    [joinedProjectIds, getPartialProjectById]
  );

  // Memoize onChange handler
  const handleProjectChange = useCallback(
    (value: string) => {
      if (value !== currentProjectDetails?.id) {
        router.push(getProjectUrl(workspaceSlug, value));
      }
    },
    [currentProjectDetails?.id, router, workspaceSlug]
  );

  // Early return if no project details
  if (!currentProjectDetails) return null;

  return (
    <Select<TProjectSwitcherOption>
      value={switcherOptions.find((option) => option.value === currentProjectDetails.id) ?? null}
      onChange={handleProjectChange}
      getValues={() => switcherOptions}
      getOptionValue={(option) => option.value}
      getOptionLabel={(option) => option.query}
      getOptionIcon={(option) => (
        <SwitcherIcon logo_props={option.logo_props} LabelIcon={ProjectsOutline} type="material" size={16} />
      )}
      placeholder={t("common.projects")}
    >
      {/* The switcher button carries its own layout; the ghost chrome contributes the hover/active
          fill and the hover-revealed chevron (which is why `ProjectHeaderButton` draws none). */}
      <Select.Trigger
        variant="select-ghost-md"
        className="h-full cursor-pointer gap-0.5 rounded-sm px-0 py-0 hover:bg-surface-2"
      >
        <ProjectHeaderButton project={currentProjectDetails} />
      </Select.Trigger>
    </Select>
  );
});
