/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function HashPropertyIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  return (
    <IconWrapper color={color} {...rest}>
      <path
        d="M12.1 1.38C12.44 1.44 12.67 1.76 12.62 2.1L12.18 4.71H14C14.35 4.71 14.62 4.99 14.62 5.33C14.62 5.68 14.35 5.96 14 5.96H11.97L11.29 10.04H13.33C13.68 10.04 13.96 10.32 13.96 10.67C13.96 11.01 13.68 11.29 13.33 11.29H11.09L10.62 14.1C10.56 14.44 10.24 14.67 9.9 14.62C9.56 14.56 9.33 14.24 9.38 13.9L9.82 11.29H5.75L5.28 14.1C5.23 14.44 4.9 14.67 4.56 14.62C4.22 14.56 3.99 14.24 4.05 13.9L4.48 11.29H2C1.65 11.29 1.38 11.01 1.38 10.67C1.38 10.32 1.65 10.04 2 10.04H4.69L5.37 5.96H2.67C2.32 5.96 2.04 5.68 2.04 5.33C2.04 4.99 2.32 4.71 2.67 4.71H5.58L6.05 1.9C6.11 1.56 6.43 1.33 6.77 1.38C7.11 1.44 7.34 1.76 7.28 2.1L6.85 4.71H10.91L11.38 1.9C11.44 1.56 11.76 1.33 12.1 1.38ZM5.96 10.04H10.03L10.71 5.96H6.64L5.96 10.04Z"
        fill={color}
      />
    </IconWrapper>
  );
}
