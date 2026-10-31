/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { EIssuesStoreType } from "@plane/types";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";

/** Returns the current store type if the layout supports it, else the first supported one. */
export const useLayoutStoreType = <T extends EIssuesStoreType>(supported: readonly [T, ...T[]]): T => {
  const storeType = useIssueStoreType();
  return supported.find((type) => type === storeType) ?? supported[0];
};
