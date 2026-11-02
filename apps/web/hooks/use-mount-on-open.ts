// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useState } from "react";

/**
 * True from the first time `isOpen` is set. Rows that own a dialog mount it only then, so a long list does not
 * mount one closed dialog per row, and the dialog stays mounted to play its close animation.
 */
export const useMountOnOpen = (isOpen: boolean): boolean => {
  const [hasOpened, setHasOpened] = useState(isOpen);
  if (isOpen && !hasOpened) setHasOpened(true);
  return hasOpened || isOpen;
};
