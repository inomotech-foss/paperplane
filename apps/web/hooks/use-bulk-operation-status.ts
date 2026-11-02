/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { EIssuesStoreType } from "@plane/types";
import { useUserPermissions } from "@/hooks/store/user";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";

// The bulk endpoints work on one project, so only lists of a single project offer bulk operations.
const BULK_OPERATION_STORE_TYPES: ReadonlySet<EIssuesStoreType> = new Set([
  EIssuesStoreType.PROJECT,
  EIssuesStoreType.CYCLE,
  EIssuesStoreType.MODULE,
  EIssuesStoreType.PROJECT_VIEW,
]);

export const getBulkOperationStatus = (storeType: EIssuesStoreType, canEdit: boolean): boolean =>
  canEdit && BULK_OPERATION_STORE_TYPES.has(storeType);

/** Whether the current list offers multi-select and bulk operations. Admins and members only. */
export const useBulkOperationStatus = (): boolean => {
  const storeType = useIssueStoreType();
  const { allowPermissions } = useUserPermissions();
  return getBulkOperationStatus(
    storeType,
    allowPermissions([EUserPermissions.ADMIN, EUserPermissions.MEMBER], EUserPermissionsLevel.PROJECT)
  );
};
