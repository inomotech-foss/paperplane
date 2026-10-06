// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { API_BASE_URL } from "@plane/constants";
import type { TProjectSidebarLink, TProjectSidebarLinkPayload } from "@plane/types";
import { APIService } from "@/services/api.service";

export class ProjectLinkService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async listWorkspaceLinks(workspaceSlug: string): Promise<TProjectSidebarLink[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/project-links/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async create(
    workspaceSlug: string,
    projectId: string,
    data: TProjectSidebarLinkPayload
  ): Promise<TProjectSidebarLink> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/links/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async update(
    workspaceSlug: string,
    projectId: string,
    linkId: string,
    data: Partial<TProjectSidebarLinkPayload>
  ): Promise<TProjectSidebarLink> {
    return this.patch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/links/${linkId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async remove(workspaceSlug: string, projectId: string, linkId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/links/${linkId}/`)
      .then(() => undefined)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async reorder(workspaceSlug: string, projectId: string, linkIds: string[]): Promise<TProjectSidebarLink[]> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/links/reorder/`, { link_ids: linkIds })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
