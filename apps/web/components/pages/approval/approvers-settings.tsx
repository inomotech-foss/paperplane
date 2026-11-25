/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { setToast } from "@plane/blocks/toast";
// components
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";
// services
import { PageApprovalService } from "@/services/page";

const service = new PageApprovalService();

type Props = {
  workspaceSlug: string;
  projectId: string;
};

/** Who may approve the project's pages. Project members and admins only; guests are not offered. */
export const PageApproversSettings = observer(function PageApproversSettings(props: Props) {
  const { workspaceSlug, projectId } = props;
  const { data: approvers, mutate } = useSWR(`PAGE_APPROVERS_${projectId}`, () =>
    service.listApprovers(workspaceSlug, projectId)
  );
  const approverIds = (approvers ?? []).map((approver) => approver.member);

  const handleChange = async (memberIds: string[]) => {
    try {
      await mutate(service.setApprovers(workspaceSlug, projectId, memberIds), { revalidate: false });
    } catch {
      setToast({ type: "error", title: "Could not update the approvers." });
    }
  };

  return (
    <SettingsBoxedControlItem
      title="Approvers"
      description={
        approverIds.length
          ? "These members approve or reject pages. Nobody can approve a version they submitted or edited."
          : "Nobody can approve pages until you add at least one approver, and preferably two."
      }
      control={
        <MemberSelect
          projectId={projectId}
          value={approverIds}
          onChange={(ids) => void handleChange(ids)}
          placeholder="Add approvers"
          multiple
          variant="select-ghost-md"
          showLabel={approverIds.length <= 1}
        />
      }
    />
  );
});
