/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
import useSWR from "swr";
// plane imports
import { Badge } from "@makeplane/propel/components/badge";
import { DateSelect } from "@plane/blocks/property-select";
import { setToast } from "@plane/blocks/toast";
import { getDate, renderFormattedDate, renderFormattedPayloadDate, renderFormattedTime } from "@plane/utils";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useQueryParams } from "@/hooks/use-query-params";
// services
import type { TPageApprovalEvent, TPageApprovalStatus } from "@/services/page";
// store
import type { TPageInstance } from "@/store/pages/base-page";
import { approvalBadge, approvalEventLabel, BASELINE_LABEL, isBaselineInForce } from "@/store/pages/page-approval";
// local imports
import { PAGE_NAVIGATION_PANE_VERSION_QUERY_PARAM } from "../navigation-pane";
import { usePageApproval } from "./use-page-approval";

type Props = {
  page: TPageInstance;
};

/** What the "In force" row says: the baseline, or the approved revision with its date and approver. */
const InForceLabel = observer(function InForceLabel({ status }: { status: TPageApprovalStatus }) {
  const { getUserDetails } = useMember();
  if (isBaselineInForce(status)) {
    return (
      <>
        Baseline, not reviewed
        {status.baselined_at ? ` (${renderFormattedDate(status.baselined_at)})` : ""}
      </>
    );
  }
  const approver = status.approved_by ? getUserDetails(status.approved_by) : undefined;
  return (
    <>
      Rev {status.revision}
      {status.approved_at ? `, ${renderFormattedDate(status.approved_at)}` : ""}
      {approver ? ` by ${approver.display_name}` : ""}
    </>
  );
});

type TNextReviewProps = {
  status: TPageApprovalStatus;
  onChange: (date: Date | null) => void;
};

/** The next review date: editable for approvers and admins, read-only for everyone else. */
function NextReviewRow({ status, onChange }: TNextReviewProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={status.is_review_overdue ? "text-danger-primary" : "text-tertiary"}>
        {status.is_review_overdue ? "Review overdue" : "Next review"}
      </span>
      {status.can_schedule_review ? (
        <DateSelect
          value={getDate(status.next_review_date) ?? null}
          onChange={onChange}
          placeholder="Not scheduled"
          clearable
          clearLabel="Not scheduled"
          variant="pill-sm"
        />
      ) : (
        <span>{status.next_review_date ? renderFormattedDate(status.next_review_date) : "Not scheduled"}</span>
      )}
    </div>
  );
}

/** One entry of the approval log. */
const ApprovalEventItem = observer(function ApprovalEventItem({ event }: { event: TPageApprovalEvent }) {
  const { getUserDetails } = useMember();
  const actor = event.actor ? getUserDetails(event.actor) : undefined;
  return (
    <li className="rounded-md bg-layer-1 px-2 py-1.5 text-11">
      <p className="font-medium">{approvalEventLabel(event)}</p>
      <p className="text-tertiary">
        {actor?.display_name ?? "Unknown user"} · {renderFormattedDate(event.created_at)},{" "}
        {renderFormattedTime(event.created_at)}
      </p>
      {event.legacy_note && <p className="mt-1 text-secondary">{event.legacy_note}</p>}
      {event.comment && <p className="mt-1 whitespace-pre-wrap text-secondary">{event.comment}</p>}
    </li>
  );
});

/** The approval state of the page, its next review, and the approval log. */
export const PageApprovalHistory = observer(function PageApprovalHistory({ page }: Props) {
  // store hooks
  const approval = usePageApproval(page);
  const { updateQueryParams } = useQueryParams();
  const { status, events } = approval;
  useSWR(status?.enabled && page.id ? `PAGE_APPROVAL_EVENTS_${page.id}` : null, () => approval.fetchEvents(), {
    revalidateOnFocus: false,
  });

  if (!status?.enabled) return null;

  const badge = approvalBadge(status);
  const baseline = isBaselineInForce(status);

  const handleReviewDate = async (date: Date | null) => {
    try {
      await approval.setReviewDate(date ? (renderFormattedPayloadDate(date) ?? null) : null);
    } catch {
      setToast({ type: "error", title: "Could not set the review date." });
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-11 font-medium text-secondary">Approval</p>
      <div className="space-y-2 text-12">
        <div className="flex items-center justify-between gap-2">
          <span className="text-tertiary">Status</span>
          <Badge variant={badge.variant} size="sm" label={badge.label} />
        </div>
        {status.in_force_version && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-tertiary">In force</span>
            <Link
              className="truncate hover:underline"
              title={baseline ? BASELINE_LABEL : undefined}
              href={updateQueryParams({
                paramsToAdd: { [PAGE_NAVIGATION_PANE_VERSION_QUERY_PARAM]: status.in_force_version },
              })}
            >
              <InForceLabel status={status} />
            </Link>
          </div>
        )}
        {baseline && <p className="text-11 text-tertiary">{status.legacy_note}</p>}
        <NextReviewRow status={status} onChange={(date) => void handleReviewDate(date)} />
      </div>
      {events.length > 0 && (
        <ul className="space-y-2">
          {events.map((event) => (
            <ApprovalEventItem key={event.id} event={event} />
          ))}
        </ul>
      )}
    </div>
  );
});
