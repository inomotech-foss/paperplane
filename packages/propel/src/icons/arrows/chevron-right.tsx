/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function ChevronRightIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  return (
    <IconWrapper color={color} clipPathId="clip0_2890_23" {...rest}>
      <path
        d="M5.56 3.56C5.8 3.31 6.2 3.31 6.44 3.56L10.44 7.56C10.69 7.8 10.69 8.2 10.44 8.44L6.44 12.44C6.2 12.69 5.8 12.69 5.56 12.44C5.31 12.2 5.31 11.8 5.56 11.56L9.12 8L5.56 4.44C5.31 4.2 5.31 3.8 5.56 3.56Z"
        fill={color}
      />
    </IconWrapper>
  );
}
