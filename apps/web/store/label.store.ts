/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set, sortBy } from "lodash-es";
import { action, computed, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
// types
import type { IIssueLabel, IIssueLabelTree } from "@plane/types";
// helpers
import { buildTree } from "@plane/utils";
// services
import { IssueLabelService } from "@/services/issue";
// store
import type { CoreRootStore } from "./root.store";

export type TLabelRootStore = {
  router: Pick<CoreRootStore["router"], "projectId">;
  workspaceRoot: Pick<CoreRootStore["workspaceRoot"], "currentWorkspace" | "getWorkspaceBySlug">;
};

export interface ILabelStore {
  //Observable
  labelMap: Record<string, IIssueLabel>;
  // computed
  projectLabels: IIssueLabel[];
  projectLabelsTree: IIssueLabelTree[];
  workspaceLabels: IIssueLabel[];
  //computed actions
  getWorkspaceLabels: (workspaceSlug: string) => IIssueLabel[];
  getWorkspaceLabelIds: (workspaceSlug: string) => string[];
  getProjectLabels: (projectId: string | undefined | null) => IIssueLabel[];
  getProjectLabelIds: (projectId: string | undefined | null) => string[];
  getLabelById: (labelId: string) => IIssueLabel | null;
  // fetch actions
  fetchWorkspaceLabels: (workspaceSlug: string) => Promise<IIssueLabel[]>;
  fetchProjectLabels: (workspaceSlug: string, projectId: string) => Promise<IIssueLabel[]>;
  // crud actions
  createLabel: (workspaceSlug: string, projectId: string, data: Partial<IIssueLabel>) => Promise<IIssueLabel>;
  updateLabel: (
    workspaceSlug: string,
    projectId: string,
    labelId: string,
    data: Partial<IIssueLabel>
  ) => Promise<IIssueLabel>;
  updateLabelPosition: (
    workspaceSlug: string,
    projectId: string,
    draggingLabelId: string,
    droppedParentId: string | null,
    droppedLabelId: string | undefined,
    dropAtEndOfList: boolean
  ) => Promise<void>;
  deleteLabel: (workspaceSlug: string, projectId: string, labelId: string) => Promise<void>;
}

export class LabelStore implements ILabelStore {
  // root store
  rootStore;
  // root store labelMap
  labelMap: Record<string, IIssueLabel> = {};
  // services
  issueLabelService;

  constructor(_rootStore: TLabelRootStore) {
    makeObservable(this, {
      labelMap: observable,
      // computed
      projectLabels: computed,
      projectLabelsTree: computed,

      fetchProjectLabels: action,
      createLabel: action,
      updateLabel: action,
      updateLabelPosition: action,
      deleteLabel: action,
    });

    // root store
    this.rootStore = _rootStore;
    // services
    this.issueLabelService = new IssueLabelService();
  }

  /**
   * Returns the labelMap belongs to a specific workspace
   */
  get workspaceLabels() {
    const currentWorkspaceDetails = this.rootStore.workspaceRoot.currentWorkspace;
    return currentWorkspaceDetails ? this.getWorkspaceLabels(currentWorkspaceDetails.slug) : [];
  }

  get projectLabels() {
    return this.getProjectLabels(this.rootStore.router.projectId);
  }

  get projectLabelsTree() {
    // buildTree writes `children` onto the items it gets, so it works on copies of the stored labels
    return buildTree(this.projectLabels.map((label) => ({ ...label })));
  }

  /** Labels of a workspace. Whether the list is complete is the query's concern, see `useWorkspaceLabels`. */
  getWorkspaceLabels = computedFn((workspaceSlug: string) => {
    const workspaceDetails = this.rootStore.workspaceRoot.getWorkspaceBySlug(workspaceSlug);
    if (!workspaceDetails) return [];
    return sortBy(
      Object.values(this.labelMap).filter((label) => label.workspace_id === workspaceDetails.id),
      "sort_order"
    );
  });

  getWorkspaceLabelIds = computedFn((workspaceSlug: string) =>
    this.getWorkspaceLabels(workspaceSlug).map((label) => label.id)
  );

  /** Labels of a project. Whether the list is complete is the query's concern, see `useProjectLabels`. */
  getProjectLabels = computedFn((projectId: string | undefined | null) => {
    if (!projectId) return [];
    return sortBy(
      Object.values(this.labelMap).filter((label) => label.project_id === projectId),
      "sort_order"
    );
  });

  getProjectLabelIds = computedFn((projectId: string | undefined | null) =>
    this.getProjectLabels(projectId).map((label) => label.id)
  );

  /**
   * get label info from the map of labels in the store using label id
   * @param labelId
   */
  getLabelById = computedFn((labelId: string): IIssueLabel | null => this.labelMap?.[labelId] || null);

  /**
   * Fetches all the labelMap belongs to a specific project
   * @param workspaceSlug
   * @param projectId
   * @returns Promise<IIssueLabel[]>
   */
  fetchProjectLabels = async (workspaceSlug: string, projectId: string) =>
    await this.issueLabelService.getProjectLabels(workspaceSlug, projectId).then((response) => {
      runInAction(() => {
        response.forEach((label) => {
          set(this.labelMap, [label.id], label);
        });
      });
      return response;
    });

  /**
   * Fetches all the labelMap belongs to a specific project
   * @param workspaceSlug
   * @param projectId
   * @returns Promise<IIssueLabel[]>
   */
  fetchWorkspaceLabels = async (workspaceSlug: string) =>
    await this.issueLabelService.getWorkspaceIssueLabels(workspaceSlug).then((response) => {
      runInAction(() => {
        response.forEach((label) => {
          set(this.labelMap, [label.id], label);
        });
      });
      return response;
    });

  /**
   * Creates a new label for a specific project and add it to the store
   * @param workspaceSlug
   * @param projectId
   * @param data
   * @returns Promise<IIssueLabel>
   */
  createLabel = async (workspaceSlug: string, projectId: string, data: Partial<IIssueLabel>) =>
    await this.issueLabelService.createIssueLabel(workspaceSlug, projectId, data).then((response) => {
      runInAction(() => {
        set(this.labelMap, [response.id], response);
      });
      return response;
    });

  /**
   * Updates a label for a specific project and update it in the store
   * @param workspaceSlug
   * @param projectId
   * @param labelId
   * @param data
   * @returns Promise<IIssueLabel>
   */
  updateLabel = async (workspaceSlug: string, projectId: string, labelId: string, data: Partial<IIssueLabel>) => {
    const originalLabel = this.labelMap[labelId];
    try {
      runInAction(() => {
        set(this.labelMap, [labelId], { ...originalLabel, ...data });
      });
      const response = await this.issueLabelService.patchIssueLabel(workspaceSlug, projectId, labelId, data);
      return response;
    } catch (error) {
      console.log("Failed to update label from project store");
      runInAction(() => {
        set(this.labelMap, [labelId], originalLabel);
      });
      throw error;
    }
  };

  /**
   * updates the sort order of a label and updates the label information using API.
   * @param workspaceSlug
   * @param projectId
   * @param labelId
   * @param parentId
   * @param index
   * @param isSameParent
   * @param prevIndex
   * @returns
   */
  updateLabelPosition = async (
    workspaceSlug: string,
    projectId: string,
    draggingLabelId: string,
    droppedParentId: string | null,
    droppedLabelId: string | undefined,
    dropAtEndOfList: boolean
  ) => {
    const currLabel = this.labelMap?.[draggingLabelId];
    const labelTree = this.projectLabelsTree;
    let currentArray: IIssueLabel[];

    if (!currLabel) return;

    //If its is dropped in the same parent then, there is not specific label on which it is mentioned then keep it's original position
    if (currLabel.parent === droppedParentId && !droppedLabelId) return;

    const data: Partial<IIssueLabel> = { parent: droppedParentId };

    // find array in which the label is to be added
    if (!droppedParentId) currentArray = labelTree;
    else currentArray = labelTree?.find((label) => label.id === droppedParentId)?.children || [];

    let droppedLabelIndex = currentArray.findIndex((label) => label.id === droppedLabelId);
    //if the position of droppedLabelId cannot be determined then drop it at the end of the list
    if (dropAtEndOfList || droppedLabelIndex === -1) droppedLabelIndex = currentArray.length;

    //if currently adding to a new array, then let backend assign a sort order
    if (currentArray.length > 0) {
      let prevSortOrder: number | undefined, nextSortOrder: number | undefined;

      if (typeof currentArray[droppedLabelIndex - 1] !== "undefined") {
        prevSortOrder = currentArray[droppedLabelIndex - 1].sort_order;
      }
      if (typeof currentArray[droppedLabelIndex] !== "undefined") {
        nextSortOrder = currentArray[droppedLabelIndex].sort_order;
      }

      let sortOrder: number = 65535;
      //based on the next and previous labelMap calculate current sort order
      if (prevSortOrder && nextSortOrder) {
        sortOrder = (prevSortOrder + nextSortOrder) / 2;
      } else if (nextSortOrder) {
        sortOrder = nextSortOrder / 2;
      } else if (prevSortOrder) {
        sortOrder = prevSortOrder + 10000;
      }
      data.sort_order = sortOrder;
    }

    await this.updateLabel(workspaceSlug, projectId, draggingLabelId, data);
  };

  /**
   * Delete the label from the project and remove it from the labelMap object
   * @param workspaceSlug
   * @param projectId
   * @param labelId
   */
  deleteLabel = async (workspaceSlug: string, projectId: string, labelId: string) => {
    if (!this.labelMap[labelId]) return;
    await this.issueLabelService.deleteIssueLabel(workspaceSlug, projectId, labelId).then(() => {
      runInAction(() => {
        delete this.labelMap[labelId];
      });
    });
  };
}
