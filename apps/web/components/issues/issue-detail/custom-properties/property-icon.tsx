/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import {
  AlignLeft,
  Calendar,
  CheckSquare,
  ChevronDownSquare,
  Hash,
  Layers,
  ListChecks,
  UserCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
// plane imports
import type { TIssueCustomPropertyType } from "@plane/types";

const PROPERTY_TYPE_ICONS: Record<TIssueCustomPropertyType, LucideIcon> = {
  TEXT: AlignLeft,
  DECIMAL: Hash,
  OPTION: ChevronDownSquare,
  DATETIME: Calendar,
  BOOLEAN: CheckSquare,
  RELATION: UserCircle2,
};

type TCustomPropertyIconProps = {
  propertyType: TIssueCustomPropertyType;
  /** "ISSUE" for a property that points at a work item rather than a member. */
  relationType?: string | null;
  className?: string;
};

export function CustomPropertyIcon(props: TCustomPropertyIconProps) {
  const { propertyType, relationType, className } = props;
  const Icon =
    propertyType === "RELATION" && relationType === "ISSUE" ? Layers : (PROPERTY_TYPE_ICONS[propertyType] ?? AlignLeft);
  return <Icon className={className} />;
}
