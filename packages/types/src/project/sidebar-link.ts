// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

export type TProjectSidebarLink = {
  id: string;
  project: string;
  title: string;
  url: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TProjectSidebarLinkPayload = Pick<TProjectSidebarLink, "title" | "url">;
