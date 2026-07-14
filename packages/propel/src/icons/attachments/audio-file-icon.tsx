/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function AudioFileIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  return (
    <IconWrapper color={color} {...rest}>
      <path
        d="M7.33 14V2C7.33 1.63 7.63 1.33 8 1.33C8.37 1.33 8.67 1.63 8.67 2V14C8.67 14.37 8.37 14.67 8 14.67C7.63 14.67 7.33 14.37 7.33 14ZM4.33 12V4C4.33 3.63 4.63 3.33 5 3.33C5.37 3.33 5.67 3.63 5.67 4V12C5.67 12.37 5.37 12.67 5 12.67C4.63 12.67 4.33 12.37 4.33 12ZM10.33 12V4C10.33 3.63 10.63 3.33 11 3.33C11.37 3.33 11.67 3.63 11.67 4V12C11.67 12.37 11.37 12.67 11 12.67C10.63 12.67 10.33 12.37 10.33 12ZM1.33 9.33V6.67C1.33 6.3 1.63 6 2 6C2.37 6 2.67 6.3 2.67 6.67V9.33C2.67 9.7 2.37 10 2 10C1.63 10 1.33 9.7 1.33 9.33ZM13.33 9.33V6.67C13.33 6.3 13.63 6 14 6C14.37 6 14.67 6.3 14.67 6.67V9.33C14.67 9.7 14.37 10 14 10C13.63 10 13.33 9.7 13.33 9.33Z"
        fill={color}
      />
    </IconWrapper>
  );
}
