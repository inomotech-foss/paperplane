/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function ChevronUpIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  return (
    <IconWrapper color={color} clipPathId="clip0_2890_23" {...rest}>
      <path
        d="M7.66 5.48C7.9 5.32 8.23 5.34 8.44 5.56L12.44 9.56C12.69 9.8 12.69 10.2 12.44 10.44C12.2 10.69 11.8 10.69 11.56 10.44L8 6.89L4.44 10.44C4.2 10.69 3.8 10.69 3.56 10.44C3.31 10.2 3.31 9.8 3.56 9.56L7.56 5.56L7.66 5.48Z"
        fill={color}
      />
    </IconWrapper>
  );
}
