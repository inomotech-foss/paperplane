/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { LucideIcon } from "lucide-react";
import { SlidersHorizontal, Layers, Mail } from "lucide-react";
import {
  CyclesOutline,
  EstimateOutline,
  IntakeOutline,
  LabelsOutline,
  LinkOutline,
  MembersOutline,
  ModuleOutline,
  PagesOutline,
  StateOutline,
  TriggerOutline,
  ViewsOutline,
} from "@makeplane/propel/icons";
// plane imports
import type { ISvgIcons } from "@plane/blocks/icons";
import type { TProjectSettingsTabs } from "@plane/types";
// components
import { SettingIcon } from "@/components/icons/attachment";

export const PROJECT_SETTINGS_ICONS: Record<TProjectSettingsTabs, LucideIcon | React.FC<ISvgIcons>> = {
  general: SettingIcon,
  members: MembersOutline,
  features_cycles: CyclesOutline,
  features_modules: ModuleOutline,
  features_views: ViewsOutline,
  features_pages: PagesOutline,
  features_intake: IntakeOutline,
  links: LinkOutline,
  states: StateOutline,
  labels: LabelsOutline,
  "custom-fields": SlidersHorizontal,
  "work-item-types": Layers,
  estimates: EstimateOutline,
  automations: TriggerOutline,
  "service-desk": Mail,
};
