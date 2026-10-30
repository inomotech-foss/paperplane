/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ChangeHandlerPayload } from "@plane/blocks/emoji-icon-picker";
import type { TLogoProps } from "@plane/types";

/** Converts an emoji/icon picker selection to logo props. */
export const getLogoPropsFromPicker = (value: ChangeHandlerPayload): TLogoProps =>
  value.type === "emoji" ? { in_use: "emoji", emoji: { value: value.value } } : { in_use: "icon", icon: value.value };
