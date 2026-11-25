/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
// store
import type { TPageInstance } from "@/store/pages/base-page";

/** Loads the page's approval status once for every component that shows it. */
export const usePageApproval = (page: TPageInstance) => {
  const { approval, id } = page;
  useSWR(id ? `PAGE_APPROVAL_${id}` : null, id ? () => approval.fetch() : null, {
    revalidateOnFocus: false,
  });
  return approval;
};
