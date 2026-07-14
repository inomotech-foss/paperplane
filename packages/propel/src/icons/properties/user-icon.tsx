/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function UserPropertyIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  return (
    <IconWrapper color={color} {...rest}>
      <path
        d="M12.71 14C12.71 13.02 12.7 12.67 12.62 12.41C12.42 11.75 11.91 11.24 11.26 11.05C10.99 10.96 10.64 10.96 9.67 10.96H6.33C5.36 10.96 5.01 10.96 4.74 11.05C4.09 11.24 3.58 11.75 3.38 12.41C3.3 12.67 3.29 13.02 3.29 14C3.29 14.35 3.01 14.62 2.67 14.62C2.32 14.62 2.04 14.35 2.04 14C2.04 13.12 2.03 12.53 2.18 12.04C2.5 10.99 3.33 10.17 4.38 9.85C4.87 9.7 5.45 9.71 6.33 9.71H9.67C10.55 9.71 11.13 9.7 11.62 9.85C12.67 10.17 13.5 10.99 13.82 12.04C13.97 12.53 13.96 13.12 13.96 14C13.96 14.35 13.68 14.62 13.33 14.62C12.99 14.62 12.71 14.35 12.71 14ZM10.37 5C10.37 3.69 9.31 2.62 8 2.62C6.69 2.63 5.62 3.69 5.62 5C5.62 6.31 6.69 7.37 8 7.38C9.31 7.38 10.37 6.31 10.37 5ZM11.62 5C11.62 7 10 8.62 8 8.62C6 8.62 4.37 7 4.37 5C4.37 3 6 1.38 8 1.38C10 1.38 11.62 3 11.62 5Z"
        fill={color}
      />
    </IconWrapper>
  );
}
