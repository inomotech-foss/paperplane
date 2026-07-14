/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function WikiIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  return (
    <IconWrapper color={color} {...rest}>
      <path
        d="M14.11 6.74L9.27 1.9C8.57 1.21 7.44 1.21 6.74 1.9L1.9 6.74C1.21 7.44 1.21 8.57 1.9 9.27L6.74 14.11C7.44 14.8 8.57 14.8 9.27 14.11L14.11 9.27C14.8 8.57 14.8 7.44 14.11 6.74ZM10.36 9.75C10.36 10.09 10.09 10.36 9.75 10.36H6.26C5.92 10.36 5.64 10.09 5.64 9.75V6.26C5.64 5.92 5.92 5.64 6.26 5.64H9.75C10.09 5.64 10.36 5.92 10.36 6.26V9.75Z"
        fill={color}
      />
    </IconWrapper>
  );
}
