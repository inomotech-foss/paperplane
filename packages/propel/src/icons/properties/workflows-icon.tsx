/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function WorkflowsPropertyIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  return (
    <IconWrapper color={color} {...rest}>
      <path
        d="M6.71 3.33C6.71 2.94 6.39 2.62 6 2.62H3.33C2.94 2.63 2.63 2.94 2.62 3.33V6C2.62 6.39 2.94 6.71 3.33 6.71H6C6.39 6.71 6.71 6.39 6.71 6V3.33ZM7.96 6C7.96 7.08 7.08 7.96 6 7.96H3.33C2.25 7.96 1.38 7.08 1.38 6V3.33C1.38 2.25 2.25 1.38 3.33 1.38H6C7.08 1.38 7.96 2.25 7.96 3.33V6Z"
        fill={color}
      />
      <path
        d="M4.04 10V7.33C4.04 6.99 4.32 6.71 4.67 6.71C5.01 6.71 5.29 6.99 5.29 7.33V10C5.29 10.19 5.37 10.37 5.5 10.5C5.63 10.63 5.81 10.71 6 10.71H8.67C9.01 10.71 9.29 10.99 9.29 11.33C9.29 11.68 9.01 11.96 8.67 11.96H6C5.48 11.96 4.98 11.75 4.61 11.39C4.25 11.02 4.04 10.52 4.04 10Z"
        fill={color}
      />
      <path
        d="M13.37 10C13.37 9.61 13.06 9.29 12.67 9.29H10C9.61 9.29 9.29 9.61 9.29 10V12.67C9.29 13.06 9.61 13.37 10 13.37H12.67C13.06 13.37 13.37 13.06 13.37 12.67V10ZM14.62 12.67C14.62 13.75 13.75 14.62 12.67 14.62H10C8.92 14.62 8.04 13.75 8.04 12.67V10C8.04 8.92 8.92 8.04 10 8.04H12.67C13.75 8.04 14.62 8.92 14.62 10V12.67Z"
        fill={color}
      />
    </IconWrapper>
  );
}
