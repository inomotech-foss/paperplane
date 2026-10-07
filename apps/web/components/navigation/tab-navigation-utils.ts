/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TTabPreferences = {
  // Unset means the project landing picks the first available tab.
  defaultTab: string | undefined;
  hiddenTabs: string[];
};
