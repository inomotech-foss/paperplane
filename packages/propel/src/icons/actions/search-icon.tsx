/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function SearchIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  return (
    <IconWrapper color={color} {...rest}>
      <path
        d="M10.46 6.42C10.46 4.18 8.65 2.38 6.42 2.38C4.18 2.38 2.38 4.18 2.38 6.42C2.38 8.65 4.18 10.46 6.42 10.46C8.65 10.46 10.46 8.65 10.46 6.42ZM11.71 6.42C11.71 7.65 11.28 8.79 10.57 9.69L14.19 13.31C14.44 13.55 14.44 13.95 14.19 14.19C13.95 14.44 13.55 14.44 13.31 14.19L9.69 10.57C8.79 11.28 7.65 11.71 6.42 11.71C3.49 11.71 1.13 9.34 1.12 6.42C1.12 3.49 3.49 1.12 6.42 1.12C9.34 1.13 11.71 3.49 11.71 6.42Z"
        fill={color}
      />
    </IconWrapper>
  );
}
