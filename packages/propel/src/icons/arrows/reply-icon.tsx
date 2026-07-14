/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function ReplyIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  return (
    <IconWrapper color={color} clipPathId="clip0_2890_23" {...rest}>
      <path
        d="M5.53 4.2C5.79 3.93 6.21 3.93 6.47 4.2C6.73 4.46 6.73 4.88 6.47 5.14L4.28 7.33H10.67C11.55 7.33 12.4 7.68 13.02 8.31C13.65 8.93 14 9.78 14 10.67V12C14 12.37 13.7 12.67 13.33 12.67C12.97 12.67 12.67 12.37 12.67 12V10.67C12.67 10.14 12.46 9.63 12.08 9.25C11.75 8.92 11.32 8.72 10.86 8.68L10.67 8.67H4.28L6.47 10.86C6.73 11.12 6.73 11.54 6.47 11.8C6.21 12.06 5.79 12.06 5.53 11.8L2.2 8.47C2.16 8.44 2.14 8.41 2.11 8.37C2.09 8.34 2.08 8.32 2.07 8.29C2.05 8.26 2.04 8.23 2.03 8.19C2.03 8.18 2.02 8.17 2.02 8.16C2.01 8.11 2 8.06 2 8C2 7.95 2.01 7.9 2.02 7.85C2.02 7.83 2.02 7.82 2.03 7.8C2.04 7.77 2.05 7.74 2.07 7.71C2.08 7.68 2.09 7.66 2.11 7.63C2.13 7.6 2.16 7.56 2.2 7.53L5.53 4.2Z"
        fill={color}
      />
    </IconWrapper>
  );
}
