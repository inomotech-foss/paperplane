/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { Button } from "@makeplane/propel/components/button";
// components
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";
// hooks
import { useProject } from "@/hooks/store/use-project";
// local imports
import { IssueSequenceStartModal } from "../issue-sequence-start-modal";

type Props = {
  workspaceSlug: string;
  projectId: string;
};

export const ProjectIssueSequenceSection = observer(function ProjectIssueSequenceSection(props: Props) {
  const { workspaceSlug, projectId } = props;
  // states
  const [isModalOpen, setIsModalOpen] = useState(false);
  // store hooks
  const { currentProjectDetails, setProjectNextSequence } = useProject();

  if (!currentProjectDetails) return null;

  const { identifier, next_work_item_sequence: nextSequence } = currentProjectDetails;

  return (
    <div className="mt-10">
      {nextSequence !== undefined && (
        <IssueSequenceStartModal
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          identifier={identifier}
          nextSequence={nextSequence}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onUpdated={(next) => setProjectNextSequence(projectId, next)}
        />
      )}
      <SettingsBoxedControlItem
        title="Work item numbering"
        description={
          <>
            The next work item created in this project will be{" "}
            {nextSequence !== undefined ? (
              <span className="font-medium text-primary">
                {identifier}-{nextSequence}
              </span>
            ) : (
              <span className="inline-block h-3 w-16 animate-pulse rounded-sm bg-layer-1 align-middle" />
            )}
            . You can move the numbering forward, for example to start new work items at {identifier}-5000. Existing
            work items keep their numbers.
          </>
        }
        control={
          <Button
            variant="secondary"
            size="sm"
            stretch="auto"
            onClick={() => setIsModalOpen(true)}
            disabled={nextSequence === undefined}
            label="Change"
          />
        }
      />
    </div>
  );
});
