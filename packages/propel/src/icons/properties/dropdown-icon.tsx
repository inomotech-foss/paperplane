/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function DropdownPropertyIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  const clipPathId = React.useId();

  return (
    <IconWrapper color={color} clipPathId={clipPathId} {...rest}>
      <path
        d="M14.04 8C14.04 4.66 11.34 1.96 8 1.96C4.66 1.96 1.96 4.66 1.96 8C1.96 11.34 4.66 14.04 8 14.04C11.34 14.04 14.04 11.34 14.04 8ZM10.22 6.56C10.47 6.31 10.86 6.31 11.11 6.56C11.35 6.8 11.35 7.2 11.11 7.44L8.44 10.11C8.32 10.23 8.17 10.29 8 10.29C7.83 10.29 7.67 10.23 7.56 10.11L4.89 7.44C4.65 7.2 4.65 6.8 4.89 6.56C5.13 6.31 5.53 6.31 5.78 6.56L8 8.78L10.22 6.56ZM15.29 8C15.29 12.03 12.03 15.29 8 15.29C3.97 15.29 0.71 12.03 0.71 8C0.71 3.97 3.97 0.71 8 0.71C12.03 0.71 15.29 3.97 15.29 8Z"
        fill={color}
      />
    </IconWrapper>
  );
}
