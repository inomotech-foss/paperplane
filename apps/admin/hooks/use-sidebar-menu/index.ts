/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTranslation } from "@plane/i18n";
// local imports
import { coreSidebarMenuLinks } from "./core";
import type { TSidebarMenuItem } from "./types";

export function useSidebarMenu(): TSidebarMenuItem[] {
  const { t } = useTranslation();
  return [
    coreSidebarMenuLinks.general,
    coreSidebarMenuLinks.email,
    coreSidebarMenuLinks["service-desk"],
    coreSidebarMenuLinks.authentication,
    coreSidebarMenuLinks["oauth-applications"],
    coreSidebarMenuLinks.workspace,
    coreSidebarMenuLinks.users,
    { ...coreSidebarMenuLinks.ai, description: t("instance_ai.sidebar_description") },
    coreSidebarMenuLinks.image,
    coreSidebarMenuLinks["rate-limits"],
  ];
}
