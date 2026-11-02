// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useState } from "react";

/**
 * Which of a row's dialogs is open. The row owns it, so a dialog stays open when its menu moves to another place,
 * for example when the window crosses a breakpoint.
 */
export type TRowDialog<T extends string> = {
  open: T | null;
  setOpen: (dialog: T | null) => void;
};

export const useRowDialog = <T extends string>(): TRowDialog<T> => {
  const [open, setOpen] = useState<T | null>(null);
  return { open, setOpen };
};
