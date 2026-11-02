// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useCallback, useRef } from "react";

/**
 * A ref callback for the page editor. The editor hands out a new ref when its provider changes,
 * so the store follows every one and its listeners never stay on a destroyed provider.
 */
export const usePageEditorRef = <T>(setEditorRef: (editorRef: T | null) => void) => {
  const editorRef = useRef<T>(null);
  const editorRefCallback = useCallback(
    (instance: T | null) => {
      editorRef.current = instance;
      if (instance) setEditorRef(instance);
    },
    [setEditorRef]
  );
  return { editorRef, editorRefCallback };
};
