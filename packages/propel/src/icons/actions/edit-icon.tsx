/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export const EditIcon: React.FC<ISvgIcons> = ({ color = "currentColor", ...rest }) => {
  const clipPathId = React.useId();
  return (
    <IconWrapper color={color} clipPathId={clipPathId} {...rest}>
      <path
        d="M10.75 1.64C11.73 0.66 13.32 0.66 14.3 1.64C15.28 2.62 15.28 4.21 14.3 5.19L5.5 13.99C5.32 14.17 5.17 14.32 4.99 14.44C4.84 14.54 4.68 14.61 4.52 14.67C4.31 14.73 4.1 14.75 3.85 14.78L1.59 15.03C1.41 15.05 1.22 14.99 1.08 14.85C0.95 14.72 0.88 14.53 0.9 14.34L1.15 12.09C1.18 11.84 1.2 11.62 1.27 11.42C1.32 11.25 1.4 11.09 1.5 10.95C1.61 10.77 1.77 10.62 1.95 10.44L10.75 1.64ZM2.83 11.32C2.62 11.54 2.57 11.59 2.54 11.63C2.51 11.69 2.48 11.74 2.46 11.8C2.44 11.86 2.43 11.92 2.4 12.22L2.23 13.7L3.71 13.54C3.86 13.52 3.95 13.51 4.01 13.5L4.13 13.48C4.19 13.46 4.25 13.43 4.3 13.4C4.35 13.36 4.4 13.32 4.61 13.11L10.97 6.74L9.19 4.96L2.83 11.32ZM13.42 2.52C12.92 2.03 12.13 2.03 11.63 2.52L10.07 4.08L11.86 5.86L13.42 4.3C13.91 3.81 13.91 3.01 13.42 2.52Z"
        fill={color}
      />
    </IconWrapper>
  );
};
