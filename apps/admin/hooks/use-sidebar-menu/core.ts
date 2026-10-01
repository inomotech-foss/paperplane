/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { BrainCog, Gauge, Headset, Plug, Users } from "lucide-react";
// plane imports
import { ImageOutline, LockOutline, MailOutline, SettingsOutline, WorkspaceOutline } from "@makeplane/propel/icons";
// types
import type { TSidebarMenuItem } from "./types";

export type TCoreSidebarMenuKey =
  | "general"
  | "email"
  | "service-desk"
  | "workspace"
  | "users"
  | "authentication"
  | "ai"
  | "image"
  | "rate-limits"
  | "oauth-applications";

export const coreSidebarMenuLinks: Record<TCoreSidebarMenuKey, TSidebarMenuItem> = {
  general: {
    Icon: SettingsOutline,
    name: "General",
    description: "Identify your instances and get key details.",
    href: `/general/`,
  },
  email: {
    Icon: MailOutline,
    name: "Email",
    description: "Configure your SMTP controls.",
    href: `/email/`,
  },
  "service-desk": {
    Icon: Headset,
    name: "Service Desk",
    description: "Configure the Microsoft 365 service desk integration.",
    href: `/service-desk/`,
  },
  workspace: {
    Icon: WorkspaceOutline,
    name: "Workspaces",
    description: "Manage all workspaces on this instance.",
    href: `/workspace/`,
  },
  users: {
    Icon: Users,
    name: "Users",
    description: "Deactivate, merge or delete user accounts.",
    href: `/users/`,
  },
  authentication: {
    Icon: LockOutline,
    name: "Authentication",
    description: "Configure authentication modes.",
    href: `/authentication/`,
  },
  ai: {
    Icon: BrainCog,
    name: "Artificial intelligence",
    description: "Configure your OpenAI creds.",
    href: `/ai/`,
  },
  image: {
    Icon: ImageOutline,
    name: "Images in Plane",
    description: "Allow third-party image libraries.",
    href: `/image/`,
  },
  "rate-limits": {
    Icon: Gauge,
    name: "Rate limits",
    description: "Tune API and authentication request limits.",
    href: `/rate-limits/`,
  },
  "oauth-applications": {
    Icon: Plug,
    name: "OAuth applications",
    description: "Register clients such as the MCP server.",
    href: `/oauth-applications/`,
  },
};
