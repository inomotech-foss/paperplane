/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import {
  approvalBadge,
  approvalEventLabel,
  canSubmitForReview,
  decisionBlockedMessage,
  showsApprovedVersion,
} from "./page-approval";

const approved = { enabled: true, approved_version: "v1" };

describe("showsApprovedVersion", () => {
  it("shows readers the version in force", () => {
    expect(showsApprovedVersion(approved, false, undefined)).toBe(true);
  });

  it("shows editors the draft unless they ask for the approved version", () => {
    expect(showsApprovedVersion(approved, true, undefined)).toBe(false);
    expect(showsApprovedVersion(approved, true, "approved")).toBe(true);
  });

  it("lets an editor go back to the draft", () => {
    expect(showsApprovedVersion(approved, true, "draft")).toBe(false);
  });

  it("shows the draft when nothing is approved yet", () => {
    expect(showsApprovedVersion({ enabled: true, approved_version: null }, false, "approved")).toBe(false);
  });

  it("never applies to projects without approvals", () => {
    expect(showsApprovedVersion({ enabled: false, approved_version: "v1" }, false, undefined)).toBe(false);
    expect(showsApprovedVersion(undefined, false, undefined)).toBe(false);
  });
});

describe("canSubmitForReview", () => {
  const status = { enabled: true, status: "draft" as const, has_unapproved_changes: true };

  it("lets editors submit a draft", () => {
    expect(canSubmitForReview(status, true)).toBe(true);
  });

  it("does not offer it to readers", () => {
    expect(canSubmitForReview(status, false)).toBe(false);
  });

  it("does not offer it for an approved page without changes", () => {
    expect(canSubmitForReview({ ...status, status: "approved", has_unapproved_changes: false }, true)).toBe(false);
    expect(canSubmitForReview({ ...status, status: "approved", has_unapproved_changes: true }, true)).toBe(true);
  });

  it("does not offer it when approvals are off", () => {
    expect(canSubmitForReview({ ...status, enabled: false }, true)).toBe(false);
  });
});

describe("labels", () => {
  it("names the revision of an approved page", () => {
    expect(approvalBadge({ status: "approved", revision: 3 })).toEqual({
      label: "Approved · Rev 3",
      variant: "success",
    });
    expect(approvalBadge({ status: "in_review", revision: 3 }).label).toBe("In review");
  });

  it("explains why an approver cannot decide", () => {
    expect(decisionBlockedMessage({ decision_blocked_reason: "SEGREGATION_OF_DUTIES" })).toMatch(/another approver/);
    expect(decisionBlockedMessage({ decision_blocked_reason: null })).toBeUndefined();
  });

  it("describes each event in the log", () => {
    expect(approvalEventLabel({ action: "approved", revision: 2, next_review_date: "2027-01-01" })).toBe(
      "Approved as Rev 2"
    );
    expect(approvalEventLabel({ action: "review_date_set", revision: null, next_review_date: null })).toBe(
      "Review date cleared"
    );
    expect(approvalEventLabel({ action: "submitted", revision: null, next_review_date: null })).toBe(
      "Submitted for review"
    );
  });
});
