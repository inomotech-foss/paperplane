/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export const CheckIcon: React.FC<ISvgIcons> = ({ color = "currentColor", ...rest }) => (
  <IconWrapper color={color} {...rest}>
    <path
      d="M12.97 3.78C13.22 3.54 13.61 3.54 13.86 3.78C14.1 4.03 14.1 4.42 13.86 4.67L6.53 12C6.28 12.24 5.89 12.24 5.64 12L2.31 8.67C2.06 8.42 2.06 8.03 2.31 7.78C2.55 7.54 2.95 7.54 3.19 7.78L6.08 10.67L12.97 3.78Z"
      fill={color}
    />
  </IconWrapper>
);
