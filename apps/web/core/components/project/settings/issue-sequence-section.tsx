/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { Button } from "@plane/propel/button";
// components
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";
// hooks
import { useProject } from "@/hooks/store/use-project";
// services
import { ProjectService } from "@/services/project";
// local imports
import { IssueSequenceStartModal } from "../issue-sequence-start-modal";

type Props = {
  workspaceSlug: string;
  projectId: string;
};

const projectService = new ProjectService();

export const ProjectIssueSequenceSection = observer(function ProjectIssueSequenceSection(props: Props) {
  const { workspaceSlug, projectId } = props;
  // states
  const [isModalOpen, setIsModalOpen] = useState(false);
  // store hooks
  const { currentProjectDetails } = useProject();
  // fetch the current numbering
  const { data: sequence, mutate } = useSWR(
    workspaceSlug && projectId ? `PROJECT_ISSUE_SEQUENCE_${workspaceSlug}_${projectId}` : null,
    workspaceSlug && projectId ? () => projectService.getIssueSequence(workspaceSlug, projectId) : null
  );

  if (!currentProjectDetails) return null;

  const identifier = currentProjectDetails.identifier;

  return (
    <div className="mt-10">
      {sequence && (
        <IssueSequenceStartModal
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          identifier={identifier}
          sequence={sequence}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onUpdated={(updated) => mutate(updated, { revalidate: false })}
        />
      )}
      <SettingsBoxedControlItem
        title="Work item numbering"
        description={
          sequence ? (
            <>
              The next work item created in this project will be{" "}
              <span className="font-medium text-primary">
                {identifier}-{sequence.next_sequence}
              </span>
              . You can move the numbering forward, for example to start new work items at {identifier}-5000. Existing
              work items keep their numbers.
            </>
          ) : (
            "Loading the current numbering."
          )
        }
        control={
          <Button variant="secondary" onClick={() => setIsModalOpen(true)} disabled={!sequence}>
            Change
          </Button>
        }
      />
    </div>
  );
});
