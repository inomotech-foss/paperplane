/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ArchiveTabsList } from "../archive-tabs-list";

export function DeletedWorkItemsHeader() {
  return (
    <div className="flex border-b border-subtle">
      <div className="horizontal-scrollbar scrollbar-sm flex w-full items-center gap-2 overflow-x-auto px-4">
        <ArchiveTabsList />
      </div>
    </div>
  );
}
