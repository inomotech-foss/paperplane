/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { action, computed, makeObservable, observable, runInAction } from "mobx";
// services
import { PageApprovalService } from "@/services/page";
import type { TPageApprovalEvent, TPageApprovalStatus } from "@/services/page";
// local imports
import { showsApprovedVersion } from "./page-approval";
import type { TPageApprovalViewMode } from "./page-approval";

const service = new PageApprovalService();

/**
 * A page's review and approval state, for projects with page approvals switched on.
 *
 * Nothing is fetched until a component asks, so pages in projects without approvals cost one
 * status request when opened and nothing in lists.
 */
export class PageApprovalStore {
  status: TPageApprovalStatus | undefined = undefined;
  events: TPageApprovalEvent[] = [];
  /** An explicit choice of which body to show; undefined follows the default for the user's role. */
  viewMode: TPageApprovalViewMode | undefined = undefined;

  constructor(
    private workspaceSlug: string | undefined,
    private projectId: string | undefined,
    private pageId: string | undefined
  ) {
    makeObservable<PageApprovalStore, "apply">(this, {
      status: observable.ref,
      events: observable.ref,
      viewMode: observable.ref,
      isEnabled: computed,
      fetch: action,
      fetchEvents: action,
      submit: action,
      approve: action,
      reject: action,
      setReviewDate: action,
      setViewMode: action,
      apply: action,
    });
  }

  get isEnabled(): boolean {
    return !!this.status?.enabled;
  }

  showsApproved = (canEdit: boolean): boolean => showsApprovedVersion(this.status, canEdit, this.viewMode);

  setViewMode = (viewMode: TPageApprovalViewMode | undefined) => {
    this.viewMode = viewMode;
  };

  private ids(): [string, string, string] {
    if (!this.workspaceSlug || !this.projectId || !this.pageId) throw new Error("Missing required fields.");
    return [this.workspaceSlug, this.projectId, this.pageId];
  }

  private apply = (status: TPageApprovalStatus) => {
    this.status = status;
  };

  fetch = async () => {
    const status = await service.getStatus(...this.ids());
    runInAction(() => this.apply(status));
    return status;
  };

  fetchEvents = async () => {
    const events = await service.listEvents(...this.ids());
    runInAction(() => {
      this.events = events;
    });
    return events;
  };

  /** Runs an approval action, then takes the new status and refreshes the log. */
  private async act(request: Promise<TPageApprovalStatus>) {
    const status = await request;
    runInAction(() => this.apply(status));
    await this.fetchEvents();
    return status;
  }

  submit = async (comment: string) => this.act(service.submit(...this.ids(), comment));

  approve = async (comment: string, nextReviewDate: string | null) =>
    this.act(service.approve(...this.ids(), { comment, next_review_date: nextReviewDate }));

  reject = async (comment: string) => this.act(service.reject(...this.ids(), comment));

  setReviewDate = async (nextReviewDate: string | null) =>
    this.act(service.setReviewDate(...this.ids(), nextReviewDate));
}
