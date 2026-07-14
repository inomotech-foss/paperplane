/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function CloseIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  return (
    <IconWrapper color={color} clipPathId="clip0_2890_23" {...rest}>
      <path
        d="M10.85 4.18C11.09 3.94 11.49 3.94 11.73 4.18C11.98 4.43 11.98 4.82 11.73 5.07L8.84 7.96L11.73 10.85C11.98 11.09 11.98 11.49 11.73 11.73C11.49 11.98 11.09 11.98 10.85 11.73L7.96 8.84L5.07 11.73C4.82 11.98 4.43 11.98 4.18 11.73C3.94 11.49 3.94 11.09 4.18 10.85L7.07 7.96L4.18 5.07C3.94 4.82 3.94 4.43 4.18 4.18C4.43 3.94 4.82 3.94 5.07 4.18L7.96 7.07L10.85 4.18Z"
        fill={color}
      />
    </IconWrapper>
  );
}
