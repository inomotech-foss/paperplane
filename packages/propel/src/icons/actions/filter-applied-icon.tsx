/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function FilterAppliedIcon({ color = "text-icon-brand", ...rest }: ISvgIcons) {
  const clipPathId = React.useId();

  return (
    <IconWrapper color={color} clipPathId={clipPathId} {...rest}>
      <path
        d="M15.3 3.65C15.3 5.11 14.11 6.3 12.65 6.3C11.19 6.3 10 5.11 10 3.65C10 2.19 11.19 1 12.65 1C14.11 1 15.3 2.19 15.3 3.65Z"
        fill={color}
      />
      <path
        d="M10 12.33C10.37 12.33 10.67 12.63 10.67 13C10.67 13.37 10.37 13.67 10 13.67H6C5.63 13.67 5.33 13.37 5.33 13C5.33 12.63 5.63 12.33 6 12.33H10ZM12 7.67C12.37 7.67 12.67 7.97 12.67 8.33C12.67 8.7 12.37 9 12 9H4C3.63 9 3.33 8.7 3.33 8.33C3.33 7.97 3.63 7.67 4 7.67H12ZM8 3C8.37 3 8.67 3.3 8.67 3.67C8.67 4.03 8.37 4.33 8 4.33H1.33C0.96 4.33 0.67 4.03 0.67 3.67C0.67 3.3 0.96 3 1.33 3H8Z"
        fill={color}
      />
    </IconWrapper>
  );
}
