/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function ChevronLeftIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  return (
    <IconWrapper color={color} clipPathId="clip0_2890_23" {...rest}>
      <path
        d="M9.56 3.56C9.8 3.31 10.2 3.31 10.44 3.56C10.69 3.8 10.69 4.2 10.44 4.44L6.88 8L10.44 11.56C10.69 11.8 10.69 12.2 10.44 12.44C10.2 12.69 9.8 12.69 9.56 12.44L5.56 8.44C5.31 8.2 5.31 7.8 5.56 7.56L9.56 3.56Z"
        fill={color}
      />
    </IconWrapper>
  );
}
