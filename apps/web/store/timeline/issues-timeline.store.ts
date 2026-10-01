/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set } from "lodash-es";
import type { IReactionDisposer } from "mobx";
import { action, autorun, makeObservable, observable, runInAction } from "mobx";
import type { TGanttDateRollup } from "@plane/types";
import { getValueFromLocalStorage, setValueIntoLocalStorage } from "@/hooks/use-local-storage";
import { IssueService } from "@/services/issue";
import type { RootStore } from "@/store/root.store";
import type { IBaseTimelineStore } from "@/store/timeline/base-timeline.store";
import { BaseTimeLineStore } from "@/store/timeline/base-timeline.store";

const ROLL_UP_DATES_STORAGE_KEY = "timeline_roll_up_dates";
// keep the query string of one request well below common URL limits
const ROLLUP_REQUEST_CHUNK = 150;

export interface IIssuesTimeLineStore extends IBaseTimelineStore {
  isDependencyEnabled: boolean;
  /** Whether parents show the dates of the work items below them. */
  isDateRollupEnabled: boolean;
  dateRollupMap: Record<string, TGanttDateRollup>;
  toggleDateRollup: () => void;
  /** Fetch the children's date span of the given work items; ones without children are cleared. */
  fetchDateRollups: (workspaceSlug: string, projectId: string, issueIds: string[]) => Promise<void>;
}

export class IssuesTimeLineStore extends BaseTimeLineStore implements IIssuesTimeLineStore {
  isDateRollupEnabled: boolean = getValueFromLocalStorage(ROLL_UP_DATES_STORAGE_KEY, true) !== false;
  dateRollupMap: Record<string, TGanttDateRollup> = {};

  issueService = new IssueService();
  // keeps the bars in sync with the work items and their rolled-up dates
  private disposeBlockSync: IReactionDisposer;

  constructor(_rootStore: RootStore) {
    super(_rootStore);

    makeObservable(this, {
      isDateRollupEnabled: observable.ref,
      dateRollupMap: observable,
      toggleDateRollup: action,
    });

    this.disposeBlockSync = autorun(() => {
      const getIssueById = this.rootStore.issue.issues.getIssueById;
      const getRollup = this.isDateRollupEnabled ? (issueId: string) => this.dateRollupMap[issueId] : undefined;
      this.updateBlocks(getIssueById, undefined, undefined, getRollup);
    });
  }

  /** Stops syncing the bars, for tearing the store down. */
  dispose = () => {
    this.disposeBlockSync();
  };

  toggleDateRollup = () => {
    this.isDateRollupEnabled = !this.isDateRollupEnabled;
    setValueIntoLocalStorage(ROLL_UP_DATES_STORAGE_KEY, this.isDateRollupEnabled);
  };

  fetchDateRollups = async (workspaceSlug: string, projectId: string, issueIds: string[]) => {
    const chunks: string[][] = [];
    for (let i = 0; i < issueIds.length; i += ROLLUP_REQUEST_CHUNK)
      chunks.push(issueIds.slice(i, i + ROLLUP_REQUEST_CHUNK));
    const responses = await Promise.all(
      chunks.map((chunk) => this.issueService.getDateRollups(workspaceSlug, projectId, chunk))
    );
    runInAction(() => {
      responses.forEach((response, chunkIndex) => {
        for (const issueId of chunks[chunkIndex]) {
          const rollup = response?.[issueId];
          if (rollup) set(this.dateRollupMap, [issueId], rollup);
          else if (this.dateRollupMap[issueId]) delete this.dateRollupMap[issueId];
        }
      });
    });
  };
}
