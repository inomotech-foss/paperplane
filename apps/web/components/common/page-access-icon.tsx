/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ArchiveOutline, GlobeOutline, HideOutline, LockedOutline } from "@makeplane/propel/icons";
import { EPageAccess } from "@plane/constants";
import type { TPage } from "@plane/types";

export function PageAccessIcon(page: TPage) {
  return (
    <div className="flex items-center gap-1">
      {page.is_locked && <LockedOutline className="h-2.5 w-2.5 text-tertiary" />}
      {page.archived_at ? (
        <ArchiveOutline className="h-2.5 w-2.5 text-tertiary" />
      ) : page.access === EPageAccess.PUBLIC ? (
        <GlobeOutline className="h-2.5 w-2.5 text-tertiary" />
      ) : (
        <HideOutline className="h-2.5 w-2.5 text-tertiary" />
      )}
    </div>
  );
}
