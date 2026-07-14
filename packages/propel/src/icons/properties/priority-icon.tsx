/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function PriorityPropertyIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  return (
    <IconWrapper color={color} {...rest}>
      <path
        d="M3.38 13.33V10.67C3.38 10.32 3.65 10.04 4 10.04C4.35 10.04 4.62 10.32 4.62 10.67V13.33C4.62 13.68 4.35 13.96 4 13.96C3.65 13.96 3.38 13.68 3.38 13.33ZM7.38 13.33V6.67C7.38 6.32 7.65 6.04 8 6.04C8.35 6.04 8.62 6.32 8.62 6.67V13.33C8.62 13.68 8.35 13.96 8 13.96C7.65 13.96 7.38 13.68 7.38 13.33ZM11.38 13.33V2.67C11.38 2.32 11.65 2.04 12 2.04C12.35 2.04 12.62 2.32 12.62 2.67V13.33C12.62 13.68 12.35 13.96 12 13.96C11.65 13.96 11.38 13.68 11.38 13.33Z"
        fill={color}
      />
    </IconWrapper>
  );
}
