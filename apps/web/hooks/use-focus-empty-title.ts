/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { EditorTitleRefApi } from "@plane/editor";

type TArgs = {
  pageId: string | undefined;
  name: string | undefined;
  isEditable: boolean;
  isSynced: boolean;
  titleRef: RefObject<Pick<EditorTitleRefApi, "focus"> | null>;
};

/** Puts the cursor in the title of an editable page without a name, once per page after its first sync. */
export const useFocusEmptyTitle = ({ pageId, name, isEditable, isSynced, titleRef }: TArgs) => {
  const handledPageIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!pageId || !isSynced || handledPageIdRef.current === pageId) return;
    handledPageIdRef.current = pageId;
    if (isEditable && !name?.trim()) titleRef.current?.focus("end");
  }, [pageId, name, isEditable, isSynced, titleRef]);
};
