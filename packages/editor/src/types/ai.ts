/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TAIMenuProps = {
  /** The selected content as Markdown. */
  selection: string;
  /** False when the selection has mentions, images or embeds, which a replace would lose. */
  canReplace: boolean;
  /** Replaces the selection with the given HTML. */
  onReplace: (html: string) => void;
  /** Inserts the given HTML after the block that ends the selection. */
  onInsertBelow: (html: string) => void;
  onClose: () => void;
};

export type TAIHandler = {
  /** The text of the bubble menu button that opens the menu. */
  label: string;
  menu?: (props: TAIMenuProps) => React.ReactNode;
};
