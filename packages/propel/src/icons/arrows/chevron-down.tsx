/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function ChevronDownIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  return (
    <IconWrapper color={color} clipPathId="clip0_2890_23" {...rest}>
      <path
        d="M11.56 5.56C11.8 5.31 12.2 5.31 12.44 5.56C12.69 5.8 12.69 6.2 12.44 6.44L8.44 10.44C8.2 10.69 7.8 10.69 7.56 10.44L3.56 6.44C3.31 6.2 3.31 5.8 3.56 5.56C3.8 5.31 4.2 5.31 4.44 5.56L8 9.11L11.56 5.56Z"
        fill={color}
      />
    </IconWrapper>
  );
}
