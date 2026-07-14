/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function PlaneNewIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  return (
    <IconWrapper color={color} {...rest}>
      <path
        d="M10.36 10.36V12.84C10.36 13.83 9.56 14.63 8.57 14.63H3.17C2.18 14.63 1.38 13.83 1.38 12.84V7.44C1.38 6.45 2.18 5.65 3.17 5.65H5.65V8.57C5.65 9.56 6.45 10.36 7.44 10.36H10.36Z"
        fill={color}
      />
      <path
        d="M14.63 3.17V8.57C14.63 9.56 13.83 10.36 12.84 10.36H10.36V7.44C10.36 6.45 9.56 5.65 8.57 5.65H5.65V3.17C5.65 2.18 6.45 1.38 7.44 1.38H12.84C13.83 1.38 14.63 2.18 14.63 3.17Z"
        fill={color}
      />
    </IconWrapper>
  );
}
