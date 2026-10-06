// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { set, sortBy, unset } from "lodash-es";
import { action, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
import type { TProjectSidebarLink, TProjectSidebarLinkPayload } from "@plane/types";
import { ProjectLinkService } from "@/services/project";

export interface IProjectLinkStore {
  linkMap: Record<string, TProjectSidebarLink>;
  getLinksByProjectId: (projectId: string) => TProjectSidebarLink[];
  fetchWorkspaceLinks: (workspaceSlug: string) => Promise<TProjectSidebarLink[]>;
  createLink: (
    workspaceSlug: string,
    projectId: string,
    data: TProjectSidebarLinkPayload
  ) => Promise<TProjectSidebarLink>;
  updateLink: (
    workspaceSlug: string,
    projectId: string,
    linkId: string,
    data: Partial<TProjectSidebarLinkPayload>
  ) => Promise<TProjectSidebarLink>;
  deleteLink: (workspaceSlug: string, projectId: string, linkId: string) => Promise<void>;
  reorderLinks: (workspaceSlug: string, projectId: string, linkIds: string[]) => Promise<void>;
}

export const sortProjectLinks = (links: TProjectSidebarLink[]): TProjectSidebarLink[] =>
  sortBy(links, ["sort_order", "created_at"]);

export class ProjectLinkStore implements IProjectLinkStore {
  linkMap: Record<string, TProjectSidebarLink> = {};
  linkService;

  constructor() {
    makeObservable(this, {
      linkMap: observable,
      fetchWorkspaceLinks: action,
      createLink: action,
      updateLink: action,
      deleteLink: action,
      reorderLinks: action,
    });
    this.linkService = new ProjectLinkService();
  }

  getLinksByProjectId = computedFn((projectId: string): TProjectSidebarLink[] =>
    sortProjectLinks(Object.values(this.linkMap).filter((link) => link.project === projectId))
  );

  fetchWorkspaceLinks = async (workspaceSlug: string) => {
    const links = await this.linkService.listWorkspaceLinks(workspaceSlug);
    runInAction(() => {
      this.linkMap = Object.fromEntries(links.map((link) => [link.id, link]));
    });
    return links;
  };

  createLink = async (workspaceSlug: string, projectId: string, data: TProjectSidebarLinkPayload) => {
    const link = await this.linkService.create(workspaceSlug, projectId, data);
    runInAction(() => set(this.linkMap, [link.id], link));
    return link;
  };

  updateLink = async (
    workspaceSlug: string,
    projectId: string,
    linkId: string,
    data: Partial<TProjectSidebarLinkPayload>
  ) => {
    const link = await this.linkService.update(workspaceSlug, projectId, linkId, data);
    runInAction(() => set(this.linkMap, [link.id], link));
    return link;
  };

  deleteLink = async (workspaceSlug: string, projectId: string, linkId: string) => {
    await this.linkService.remove(workspaceSlug, projectId, linkId);
    runInAction(() => unset(this.linkMap, [linkId]));
  };

  reorderLinks = async (workspaceSlug: string, projectId: string, linkIds: string[]) => {
    const previous = linkIds.map((id) => this.linkMap[id]?.sort_order);
    linkIds.forEach((id, index) => {
      if (this.linkMap[id]) this.linkMap[id].sort_order = (index + 1) * 1000;
    });
    try {
      const links = await this.linkService.reorder(workspaceSlug, projectId, linkIds);
      runInAction(() => links.forEach((link) => set(this.linkMap, [link.id], link)));
    } catch (error) {
      runInAction(() =>
        linkIds.forEach((id, index) => {
          const sortOrder = previous[index];
          if (this.linkMap[id] && sortOrder !== undefined) this.linkMap[id].sort_order = sortOrder;
        })
      );
      throw error;
    }
  };
}
