/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TPageApprovalEvent, TPageApprovalState, TPageApprovalStatus } from "@/services/page";

/** Which body of a page is on screen: the version in force, or the working draft. */
export type TPageApprovalViewMode = "approved" | "draft";

type TStatusPresentation = {
  label: string;
  variant: "neutral" | "brand" | "success" | "danger" | "warning";
};

const STATUS_PRESENTATION: Record<TPageApprovalState, TStatusPresentation> = {
  draft: { label: "Draft", variant: "neutral" },
  in_review: { label: "In review", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
};

/** The badge for a page's approval state; an approved page names its revision. */
export const approvalBadge = (status: Pick<TPageApprovalStatus, "status" | "revision">): TStatusPresentation => {
  const presentation = STATUS_PRESENTATION[status.status];
  if (status.status === "approved") return { ...presentation, label: `${presentation.label} · Rev ${status.revision}` };
  return presentation;
};

/**
 * Whether the approved version is shown instead of the draft.
 *
 * Only when approvals are on and something is approved. Then an explicit choice wins, and
 * otherwise people who cannot edit the page read the version in force while editors work on the
 * draft.
 */
export const showsApprovedVersion = (
  status: Pick<TPageApprovalStatus, "enabled" | "approved_version"> | undefined,
  canEdit: boolean,
  viewMode: TPageApprovalViewMode | undefined
): boolean => {
  if (!status?.enabled || !status.approved_version) return false;
  if (viewMode) return viewMode === "approved";
  return !canEdit;
};

/** May this user submit the page now? Mirrors the server, which has the final say. */
export const canSubmitForReview = (
  status: Pick<TPageApprovalStatus, "enabled" | "status" | "has_unapproved_changes"> | undefined,
  canEdit: boolean
): boolean => {
  if (!status?.enabled || !canEdit) return false;
  return !(status.status === "approved" && !status.has_unapproved_changes);
};

const DECISION_BLOCKED: Record<string, string> = {
  SEGREGATION_OF_DUTIES: "You submitted or edited this version, so another approver has to review it.",
  NOT_AN_APPROVER: "Only the project's page approvers can approve or reject.",
  HUMAN_SESSION_REQUIRED: "Approvals need a person signed in to Paperplane.",
};

/** Why an approver cannot decide on this page, in words, or undefined. */
export const decisionBlockedMessage = (status: Pick<TPageApprovalStatus, "decision_blocked_reason"> | undefined) =>
  status?.decision_blocked_reason ? DECISION_BLOCKED[status.decision_blocked_reason] : undefined;

const EVENT_LABEL: Record<TPageApprovalEvent["action"], string> = {
  submitted: "Submitted for review",
  approved: "Approved",
  rejected: "Rejected",
  review_date_set: "Review date set",
};

/** One line of the approval history. */
export const approvalEventLabel = (event: Pick<TPageApprovalEvent, "action" | "revision" | "next_review_date">) => {
  const label = EVENT_LABEL[event.action];
  if (event.action === "approved" && event.revision) return `${label} as Rev ${event.revision}`;
  if (event.action === "review_date_set")
    return event.next_review_date ? `${label}: ${event.next_review_date}` : "Review date cleared";
  return label;
};
