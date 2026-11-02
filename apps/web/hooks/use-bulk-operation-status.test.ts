// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { EIssuesStoreType } from "@plane/types";
import { getBulkOperationStatus } from "./use-bulk-operation-status";

describe("getBulkOperationStatus", () => {
  it.each([EIssuesStoreType.PROJECT, EIssuesStoreType.CYCLE, EIssuesStoreType.MODULE, EIssuesStoreType.PROJECT_VIEW])(
    "enables %s lists for editors",
    (storeType) => {
      expect(getBulkOperationStatus(storeType, true)).toBe(true);
      expect(getBulkOperationStatus(storeType, false)).toBe(false);
    }
  );

  it.each([
    EIssuesStoreType.GLOBAL,
    EIssuesStoreType.PROFILE,
    EIssuesStoreType.ARCHIVED,
    EIssuesStoreType.WORKSPACE_DRAFT,
  ])("keeps %s lists without bulk operations", (storeType) => {
    expect(getBulkOperationStatus(storeType, true)).toBe(false);
  });
});
