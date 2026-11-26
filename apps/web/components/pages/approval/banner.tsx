/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { Banner } from "@makeplane/propel/components/banner";
import { Button } from "@makeplane/propel/components/button";
import { renderFormattedDate } from "@plane/utils";
// store
import type { TPageInstance } from "@/store/pages/base-page";
import { isBaselineInForce } from "@/store/pages/page-approval";
// local imports
import { usePageApproval } from "./use-page-approval";

type Props = {
  page: TPageInstance;
};

/**
 * Says which body is on screen: the version in force, or a draft that is not approved (yet).
 * Editors switch between the two; readers see the version in force. A baseline is in force too,
 * but the banner never calls it approved.
 */
export const PageApprovalBanner = observer(function PageApprovalBanner({ page }: Props) {
  const approval = usePageApproval(page);
  const { status } = approval;
  if (!status?.enabled) return null;

  const canEdit = page.canCurrentUserEditPage;
  const showsApproved = approval.showsApproved(canEdit);
  const approvedOn = status.approved_at ? renderFormattedDate(status.approved_at) : undefined;
  const baseline = isBaselineInForce(status);
  const newerDraft = status.has_unapproved_changes ? "A newer draft is being worked on." : undefined;

  if (showsApproved) {
    return (
      <Banner
        placement="page"
        variant="info"
        title={
          baseline
            ? "Baseline version (migrated, not reviewed in Paperplane)"
            : `Approved version (Rev ${status.revision}${approvedOn ? `, approved ${approvedOn}` : ""})`
        }
        description={baseline ? [status.legacy_note, newerDraft].filter(Boolean).join(". ") : newerDraft}
        actions={
          canEdit ? (
            <Button
              variant="secondary"
              size="sm"
              stretch="auto"
              label="Edit draft"
              onClick={() => approval.setViewMode("draft")}
            />
          ) : undefined
        }
      />
    );
  }

  if (!status.has_unapproved_changes) return null;

  return (
    <Banner
      placement="page"
      variant="warning"
      title={
        baseline
          ? "This draft has changes since the baseline. Neither has been reviewed in Paperplane."
          : status.in_force_version
            ? "This draft has changes that are not approved yet."
            : "This page has not been approved yet."
      }
      description={
        status.status === "rejected" && status.rejection_comment ? `Rejected: ${status.rejection_comment}` : undefined
      }
      actions={
        status.in_force_version ? (
          <Button
            variant="secondary"
            size="sm"
            stretch="auto"
            label={baseline ? "View baseline" : "View approved version"}
            onClick={() => approval.setViewMode("approved")}
          />
        ) : undefined
      }
    />
  );
});
