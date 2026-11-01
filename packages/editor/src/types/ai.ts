/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TAIMenuProps = {
  /** The selected content as Markdown. */
  selection: string;
  /** Replaces the selection with the given HTML. */
  onReplace: (html: string) => void;
  /** Inserts the given HTML after the block that ends the selection. */
  onInsertBelow: (html: string) => void;
  onClose: () => void;
};

export type TAIHandler = {
  menu?: (props: TAIMenuProps) => React.ReactNode;
};
