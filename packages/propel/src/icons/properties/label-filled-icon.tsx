/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function LabelFilledIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  return (
    <IconWrapper color={color} {...rest}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0.88 1.76C1.08 1.38 1.38 1.08 1.76 0.89C2.01 0.76 2.27 0.71 2.54 0.69C2.79 0.67 3.09 0.67 3.44 0.67L6.51 0.67C6.78 0.67 7.02 0.67 7.25 0.72C7.45 0.77 7.65 0.85 7.83 0.96C8.03 1.09 8.2 1.26 8.39 1.45L13.56 6.62C13.94 7 14.25 7.31 14.49 7.59C14.73 7.87 14.93 8.16 15.04 8.51C15.21 9.05 15.21 9.62 15.04 10.16C14.93 10.5 14.73 10.79 14.49 11.08C14.25 11.36 13.94 11.67 13.56 12.05L12.05 13.56C11.67 13.94 11.36 14.25 11.08 14.49C10.79 14.73 10.5 14.93 10.16 15.04C9.62 15.22 9.04 15.22 8.51 15.04C8.16 14.93 7.87 14.73 7.59 14.49C7.31 14.25 7 13.94 6.62 13.56L1.45 8.39C1.26 8.2 1.09 8.03 0.96 7.83C0.85 7.65 0.77 7.45 0.72 7.25C0.67 7.02 0.67 6.78 0.67 6.51L0.67 3.44C0.67 3.09 0.67 2.79 0.69 2.54C0.71 2.27 0.76 2.01 0.88 1.76ZM5.33 4C4.6 4 4 4.6 4 5.33C4 6.07 4.6 6.67 5.33 6.67C6.07 6.67 6.67 6.07 6.67 5.33C6.67 4.6 6.07 4 5.33 4Z"
        fill={color}
      />
    </IconWrapper>
  );
}
