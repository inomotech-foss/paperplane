/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export const GlobeIcon: React.FC<ISvgIcons> = ({ color = "currentColor", ...rest }) => {
  const clipPathId = React.useId();
  return (
    <IconWrapper color={color} clipPathId={clipPathId} {...rest}>
      <path
        d="M8 0.71C12.03 0.71 15.29 3.97 15.29 8C15.29 12.03 12.03 15.29 8 15.29C3.97 15.29 0.71 12.03 0.71 8C0.71 3.97 3.97 0.71 8 0.71ZM1.99 8.63C2.26 11.19 4.13 13.28 6.58 13.87C5.53 12.32 4.89 10.51 4.74 8.63H1.99ZM11.26 8.63C11.11 10.51 10.48 12.32 9.42 13.87C11.88 13.28 13.75 11.19 14.01 8.63H11.26ZM6 8.63C6.16 10.48 6.86 12.24 8 13.7C9.15 12.24 9.84 10.48 10.01 8.63H6ZM9.42 2.13C10.48 3.68 11.11 5.49 11.26 7.38H14.01C13.75 4.81 11.88 2.72 9.42 2.13ZM8 2.3C6.86 3.76 6.16 5.53 6 7.38H10.01C9.84 5.53 9.15 3.77 8 2.3ZM6.58 2.13C4.13 2.72 2.26 4.81 1.99 7.38H4.74C4.89 5.49 5.52 3.68 6.58 2.13Z"
        fill={color}
      />
    </IconWrapper>
  );
};
