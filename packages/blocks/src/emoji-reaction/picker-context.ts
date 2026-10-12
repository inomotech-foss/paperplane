/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { createContext } from "react";

/** Set inside an `EmojiReactionPicker`, where the add button becomes the picker trigger. */
export const EmojiReactionPickerContext = createContext<{ disabled: boolean } | null>(null);
