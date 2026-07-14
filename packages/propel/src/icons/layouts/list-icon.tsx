/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function ListLayoutIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  return (
    <IconWrapper color={color} {...rest}>
      <path
        d="M14 11.38C14.35 11.38 14.62 11.65 14.62 12C14.62 12.35 14.35 12.62 14 12.62H2C1.65 12.62 1.38 12.35 1.38 12C1.38 11.65 1.65 11.38 2 11.38H14ZM14 7.38C14.35 7.38 14.62 7.65 14.62 8C14.62 8.35 14.35 8.62 14 8.62H2C1.65 8.62 1.38 8.35 1.38 8C1.38 7.65 1.65 7.38 2 7.38H14ZM14 3.38C14.35 3.38 14.62 3.65 14.62 4C14.62 4.35 14.35 4.62 14 4.62H2C1.65 4.62 1.38 4.35 1.38 4C1.38 3.65 1.65 3.38 2 3.38H14Z"
        fill={color}
      />
    </IconWrapper>
  );
}
