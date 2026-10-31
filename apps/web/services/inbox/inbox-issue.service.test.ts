// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import type { ApiSchema } from "@plane/api-types";
import type { TIssue } from "@plane/types";
import { EInboxIssueSource, EInboxIssueStatus } from "@plane/types";
import { inboxIssueCreateBody, inboxIssueUpdateBody, toInboxIssue, toInboxIssueDetail } from "./inbox-issue.service";

const listIssue: ApiSchema<"IssueIntake"> = {
  id: "i1",
  name: "Ticket",
  priority: "high",
  sequence_id: 7,
  project_id: "p1",
  created_at: "2026-01-01T00:00:00Z",
  created_by: null,
};

const detailIssue: ApiSchema<"IssueDetail"> = {
  id: "i1",
  name: "Ticket",
  state_id: "s1",
  sort_order: 1,
  completed_at: null,
  estimate_point: null,
  priority: "high",
  start_date: null,
  target_date: null,
  sequence_id: 7,
  project_id: "p1",
  parent_id: null,
  type_id: "t1",
  sub_issues_count: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  created_by: "u1",
  updated_by: null,
  is_draft: false,
  archived_at: null,
  description_html: "<p></p>",
};

describe("toInboxIssue", () => {
  it("maps the status, source and snooze date of a list row", () => {
    const item: ApiSchema<"IntakeIssue"> = {
      id: "r1",
      status: 0,
      duplicate_to: null,
      snoozed_till: "2030-01-01T00:00:00Z",
      source: "EMAIL",
      issue: listIssue,
      created_by: "u1",
    };
    expect(toInboxIssue(item)).toEqual({
      id: "r1",
      status: EInboxIssueStatus.SNOOZED,
      snoozed_till: new Date("2030-01-01T00:00:00Z"),
      duplicate_to: undefined,
      source: EInboxIssueSource.EMAIL,
      issue: listIssue,
      created_by: "u1",
      duplicate_issue_detail: undefined,
    });
  });

  it("drops a source the client does not know", () => {
    const item: ApiSchema<"IntakeIssue"> = {
      id: "r1",
      status: -2,
      duplicate_to: null,
      snoozed_till: null,
      source: "FAX",
      issue: listIssue,
      created_by: null,
    };
    expect(toInboxIssue(item)).toMatchObject({
      status: EInboxIssueStatus.PENDING,
      source: undefined,
      snoozed_till: null,
    });
  });
});

describe("toInboxIssueDetail", () => {
  it("fills the missing lists and counts of the work item", () => {
    const detail = toInboxIssueDetail({
      id: "r1",
      status: 2,
      duplicate_to: "i2",
      snoozed_till: null,
      duplicate_issue_detail: { ...listIssue, id: "i2" },
      source: "IN_APP",
      issue: detailIssue,
    });
    expect(detail).toMatchObject({ status: EInboxIssueStatus.DUPLICATE, duplicate_to: "i2" });
    expect(detail.duplicate_issue_detail).toMatchObject({ id: "i2", sequence_id: 7 });
    expect(detail.issue).toMatchObject({ label_ids: [], assignee_ids: [], sub_issues_count: 0, created_by: "u1" });
  });
});

describe("inboxIssueCreateBody", () => {
  it("sends the work item without its state", () => {
    const body = inboxIssueCreateBody({ name: "N", type_id: "t1", state_id: "s1", priority: null, is_draft: true });
    expect(body).toEqual({ issue: { name: "N", type_id: "t1" } });
  });
});

describe("inboxIssueUpdateBody", () => {
  it("keeps the writable fields only", () => {
    const body = inboxIssueUpdateBody({ name: "N", label_ids: ["l1"], cycle_id: "c1" });
    expect(body).toEqual({ issue: { name: "N", label_ids: ["l1"] } });
  });

  it("moves skip_activity next to the work item", () => {
    const data: Partial<TIssue> = Object.assign({ description_html: "<p>x</p>" }, { skip_activity: "true" });
    expect(inboxIssueUpdateBody(data)).toMatchObject({ skip_activity: true, issue: { description_html: "<p>x</p>" } });
  });
});
