/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiRequestBody, ApiSchema } from "@plane/api-types";
import { parseWorkspaceViewProps } from "@plane/types";
import type { IWorkspaceMemberMe } from "@plane/types";

export type TWorkspaceMemberMeUpdateBody = ApiRequestBody<"/api/workspaces/{slug}/workspace-members/me/", "patch">;

export const toWorkspaceMemberMe = (member: ApiSchema<"WorkspaceMemberMe">): IWorkspaceMemberMe => ({
  ...member,
  view_props: parseWorkspaceViewProps(member.view_props),
  default_props: parseWorkspaceViewProps(member.default_props),
});
