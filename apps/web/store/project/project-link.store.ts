// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { set, sortBy, unset } from "lodash-es";
import { action, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
import type { TProjectSidebarLink, TProjectSidebarLinkPayload } from "@plane/types";
import { ProjectLinkService } from "@/services/project";

export interface IProjectLinkStore {
  /** workspaceSlug -> linkId -> link */
  linkMap: Record<string, Record<string, TProjectSidebarLink>>;
  getLinksByProjectId: (workspaceSlug: string, projectId: string) => TProjectSidebarLink[];
  fetchWorkspaceLinks: (workspaceSlug: string) => Promise<TProjectSidebarLink[]>;
  fetchProjectLinks: (workspaceSlug: string, projectId: string) => Promise<TProjectSidebarLink[]>;
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

const toMap = (links: TProjectSidebarLink[]) => Object.fromEntries(links.map((link) => [link.id, link]));

export class ProjectLinkStore implements IProjectLinkStore {
  linkMap: Record<string, Record<string, TProjectSidebarLink>> = {};
  linkService;

  constructor() {
    makeObservable(this, {
      linkMap: observable,
      fetchWorkspaceLinks: action,
      fetchProjectLinks: action,
      createLink: action,
      updateLink: action,
      deleteLink: action,
      reorderLinks: action,
    });
    this.linkService = new ProjectLinkService();
  }

  getLinksByProjectId = computedFn((workspaceSlug: string, projectId: string): TProjectSidebarLink[] =>
    sortProjectLinks(Object.values(this.linkMap[workspaceSlug] ?? {}).filter((link) => link.project === projectId))
  );

  fetchWorkspaceLinks = async (workspaceSlug: string) => {
    const links = await this.linkService.listWorkspaceLinks(workspaceSlug);
    runInAction(() => set(this.linkMap, [workspaceSlug], toMap(links)));
    return links;
  };

  fetchProjectLinks = async (workspaceSlug: string, projectId: string) => {
    const links = await this.linkService.list(workspaceSlug, projectId);
    runInAction(() => {
      const others = Object.values(this.linkMap[workspaceSlug] ?? {}).filter((link) => link.project !== projectId);
      set(this.linkMap, [workspaceSlug], toMap([...others, ...links]));
    });
    return links;
  };

  createLink = async (workspaceSlug: string, projectId: string, data: TProjectSidebarLinkPayload) => {
    const link = await this.linkService.create(workspaceSlug, projectId, data);
    runInAction(() => set(this.linkMap, [workspaceSlug, link.id], link));
    return link;
  };

  updateLink = async (
    workspaceSlug: string,
    projectId: string,
    linkId: string,
    data: Partial<TProjectSidebarLinkPayload>
  ) => {
    const link = await this.linkService.update(workspaceSlug, projectId, linkId, data);
    runInAction(() => set(this.linkMap, [workspaceSlug, link.id], link));
    return link;
  };

  deleteLink = async (workspaceSlug: string, projectId: string, linkId: string) => {
    await this.linkService.remove(workspaceSlug, projectId, linkId);
    runInAction(() => unset(this.linkMap, [workspaceSlug, linkId]));
  };

  reorderLinks = async (workspaceSlug: string, projectId: string, linkIds: string[]) => {
    const links = this.linkMap[workspaceSlug] ?? {};
    const previous = linkIds.map((id) => links[id]?.sort_order);
    linkIds.forEach((id, index) => {
      if (links[id]) links[id].sort_order = (index + 1) * 1000;
    });
    try {
      const updated = await this.linkService.reorder(workspaceSlug, projectId, linkIds);
      runInAction(() => updated.forEach((link) => set(this.linkMap, [workspaceSlug, link.id], link)));
    } catch (error) {
      runInAction(() =>
        linkIds.forEach((id, index) => {
          const sortOrder = previous[index];
          if (links[id] && sortOrder !== undefined) links[id].sort_order = sortOrder;
        })
      );
      throw error;
    }
  };
}
