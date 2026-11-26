/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { Badge } from "@makeplane/propel/components/badge";
import { Button } from "@makeplane/propel/components/button";
import { Tooltip } from "@makeplane/propel/components/tooltip";
// store
import type { TPageInstance } from "@/store/pages/base-page";
import { approvalBadge, BASELINE_LABEL, canSubmitForReview, decisionBlockedMessage } from "@/store/pages/page-approval";
// local imports
import { PageApprovalActionModal } from "./action-modal";
import type { TPageApprovalAction } from "./action-modal";
import { usePageApproval } from "./use-page-approval";

type Props = {
  page: TPageInstance;
};

/** The page's approval status, and the review actions the current user may take. */
export const PageApprovalHeaderControl = observer(function PageApprovalHeaderControl({ page }: Props) {
  // states
  const [action, setAction] = useState<TPageApprovalAction | undefined>(undefined);
  // store
  const approval = usePageApproval(page);
  const { status } = approval;

  if (!status?.enabled || page.archived_at) return null;

  const badge = approvalBadge(status);
  const blocked = status.status === "in_review" && status.is_approver ? decisionBlockedMessage(status) : undefined;
  const canSubmit = canSubmitForReview(status, page.canCurrentUserEditPage);
  // a baseline says in full what it is, and what was recorded before
  const baselineNote = status.status === "baseline" ? `${BASELINE_LABEL}. ${status.legacy_note}` : "";
  const tooltip = blocked || status.rejection_comment || baselineNote;

  return (
    <div className="flex items-center gap-1.5">
      <Tooltip label={tooltip} disabled={!tooltip}>
        <Badge variant={badge.variant} size="sm" label={badge.label} />
      </Tooltip>
      {status.is_review_overdue && <Badge variant="danger" size="sm" label="Review overdue" />}
      {status.can_decide && (
        <>
          <Button variant="primary" size="sm" stretch="auto" label="Approve" onClick={() => setAction("approve")} />
          <Button variant="secondary" size="sm" stretch="auto" label="Reject" onClick={() => setAction("reject")} />
        </>
      )}
      {canSubmit && !status.can_decide && (
        <Button
          variant="secondary"
          size="sm"
          stretch="auto"
          label={status.status === "in_review" ? "Resubmit" : "Submit for review"}
          onClick={() => setAction("submit")}
        />
      )}
      <PageApprovalActionModal action={action} approval={approval} onClose={() => setAction(undefined)} />
    </div>
  );
});
