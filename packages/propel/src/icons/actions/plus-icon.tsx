/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export const PlusIcon: React.FC<ISvgIcons> = ({ color = "currentColor", ...rest }) => (
  <IconWrapper color={color} {...rest}>
    <path
      d="M7.38 12.67V8.62H3.33C2.99 8.62 2.71 8.35 2.71 8C2.71 7.65 2.99 7.38 3.33 7.38H7.38V3.33C7.38 2.99 7.66 2.71 8 2.71C8.35 2.71 8.63 2.99 8.63 3.33V7.38H12.67C13.01 7.38 13.29 7.65 13.29 8C13.29 8.35 13.01 8.62 12.67 8.62H8.63V12.67C8.63 13.01 8.35 13.29 8 13.29C7.66 13.29 7.38 13.01 7.38 12.67Z"
      fill={color}
    />
  </IconWrapper>
);
