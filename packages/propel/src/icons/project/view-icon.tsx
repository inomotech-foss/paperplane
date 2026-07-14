/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function ViewsIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  const clipPathId = React.useId();

  return (
    <IconWrapper color={color} clipPathId={clipPathId} {...rest}>
      <path
        d="M14.39 10.77C14.7 10.62 15.08 10.75 15.23 11.05C15.39 11.36 15.26 11.74 14.95 11.89L8.52 15.11C8.47 15.13 8.33 15.21 8.18 15.24H8.18C8.07 15.26 7.95 15.26 7.83 15.24C7.68 15.21 7.54 15.13 7.49 15.11L1.06 11.89C0.75 11.74 0.63 11.36 0.78 11.05C0.93 10.75 1.31 10.62 1.62 10.77L8 13.97L14.39 10.77ZM14.39 7.44C14.7 7.29 15.08 7.41 15.23 7.72C15.39 8.03 15.26 8.4 14.95 8.56L8.52 11.77C8.47 11.8 8.33 11.87 8.18 11.9H8.18C8.07 11.92 7.95 11.92 7.83 11.9C7.68 11.87 7.54 11.8 7.49 11.77L1.06 8.56C0.75 8.4 0.63 8.03 0.78 7.72C0.93 7.41 1.31 7.29 1.62 7.44L8 10.63L14.39 7.44ZM7.92 0.75C8.01 0.74 8.1 0.75 8.18 0.76C8.33 0.79 8.47 0.87 8.52 0.89L14.95 4.11C15.16 4.21 15.3 4.43 15.3 4.67C15.3 4.9 15.16 5.12 14.95 5.22L8.52 8.44C8.47 8.47 8.33 8.54 8.18 8.57H8.18C8.07 8.59 7.95 8.59 7.83 8.57C7.68 8.54 7.54 8.47 7.49 8.44L1.06 5.22C0.85 5.12 0.71 4.9 0.71 4.67C0.71 4.43 0.85 4.21 1.06 4.11L7.49 0.89C7.54 0.87 7.68 0.79 7.83 0.76L7.92 0.75ZM2.74 4.67L8 7.3L13.28 4.67L8 2.03L2.74 4.67Z"
        fill={color}
      />
    </IconWrapper>
  );
}
