/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// components
import type { TAppliedMembersFiltersProps } from "@/components/common/applied-filters/member-chips";
import { AppliedMemberChips } from "@/components/common/applied-filters/member-chips";

export function AppliedMembersFilters(props: TAppliedMembersFiltersProps) {
  return <AppliedMemberChips {...props} chipClassName="p-1" />;
}
