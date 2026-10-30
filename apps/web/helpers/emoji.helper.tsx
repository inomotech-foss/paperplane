/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ChangeHandlerPayload } from "@plane/blocks/emoji-icon-picker";
import type { TLogoProps } from "@plane/types";

/**
 * Renders an emoji or icon
 * @param {string | { name: string; color: string }} emoji - The emoji or icon to render
 * @returns {React.ReactNode} The rendered emoji or icon
 */
export const renderEmoji = (
  emoji:
    | string
    | {
        name: string;
        color: string;
      }
): React.ReactNode => {
  if (!emoji) return;

  if (typeof emoji === "object")
    return (
      <span style={{ fontSize: "16px", color: emoji.color }} className="material-symbols-rounded">
        {emoji.name}
      </span>
    );
  else return isNaN(parseInt(emoji)) ? emoji : String.fromCodePoint(parseInt(emoji));
};

export const getLogoPropsFromPicker = (value: ChangeHandlerPayload): TLogoProps =>
  value.type === "emoji" ? { in_use: "emoji", emoji: { value: value.value } } : { in_use: "icon", icon: value.value };
