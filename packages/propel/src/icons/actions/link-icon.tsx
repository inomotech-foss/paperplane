/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export const LinkIcon: React.FC<ISvgIcons> = ({ color = "currentColor", ...rest }) => (
  <IconWrapper color={color} {...rest}>
    <path
      d="M3.3 7.07C3.55 6.83 3.94 6.83 4.19 7.07C4.43 7.32 4.43 7.71 4.19 7.96L3.24 8.9C2.19 9.96 2.19 11.67 3.24 12.73C4.3 13.79 6.02 13.79 7.07 12.73L8.02 11.79C8.26 11.54 8.66 11.54 8.9 11.79C9.14 12.03 9.14 12.43 8.9 12.67L7.96 13.61C6.41 15.16 3.91 15.16 2.36 13.61C0.81 12.07 0.81 9.56 2.36 8.02L3.3 7.07ZM9.88 5.21C10.12 4.97 10.52 4.97 10.76 5.21C11.01 5.46 11.01 5.85 10.76 6.1L6.1 10.76C5.85 11.01 5.46 11.01 5.21 10.76C4.97 10.52 4.97 10.12 5.21 9.88L9.88 5.21ZM8.02 2.36C9.56 0.81 12.07 0.81 13.61 2.36C15.16 3.91 15.16 6.41 13.61 7.96L12.67 8.9C12.43 9.14 12.03 9.14 11.79 8.9C11.54 8.66 11.54 8.26 11.79 8.02L12.73 7.07C13.79 6.02 13.79 4.3 12.73 3.24C11.67 2.19 9.96 2.19 8.9 3.24L7.96 4.19C7.71 4.43 7.32 4.43 7.07 4.19C6.83 3.94 6.83 3.55 7.07 3.3L8.02 2.36Z"
      fill={color}
    />
  </IconWrapper>
);
