/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function BooleanPropertyIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  return (
    <IconWrapper color={color} {...rest}>
      <path
        d="M14.04 8C14.04 6.14 12.53 4.62 10.67 4.62H5.33C3.47 4.62 1.96 6.14 1.96 8C1.96 9.86 3.47 11.38 5.33 11.38H10.67C12.53 11.38 14.04 9.86 14.04 8ZM11.71 8C11.71 7.42 11.24 6.96 10.67 6.96C10.09 6.96 9.62 7.42 9.62 8C9.63 8.57 10.09 9.04 10.67 9.04C11.24 9.04 11.71 8.58 11.71 8ZM12.96 8C12.96 9.27 11.93 10.29 10.67 10.29C9.4 10.29 8.38 9.27 8.38 8C8.38 6.73 9.4 5.71 10.67 5.71C11.93 5.71 12.96 6.73 12.96 8ZM15.29 8C15.29 10.55 13.22 12.62 10.67 12.62H5.33C2.78 12.62 0.71 10.55 0.71 8C0.71 5.45 2.78 3.38 5.33 3.38H10.67C13.22 3.38 15.29 5.45 15.29 8Z"
        fill={color}
      />
    </IconWrapper>
  );
}
