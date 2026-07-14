/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function AddIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  const clipPathId = React.useId();

  return (
    <IconWrapper color={color} clipPathId={clipPathId} {...rest}>
      <path
        d="M14.04 8C14.04 4.66 11.34 1.96 8 1.96C4.66 1.96 1.96 4.66 1.96 8C1.96 11.34 4.66 14.04 8 14.04C11.34 14.04 14.04 11.34 14.04 8ZM7.38 10.67V8.62H5.33C4.99 8.62 4.71 8.35 4.71 8C4.71 7.65 4.99 7.38 5.33 7.38H7.38V5.33C7.38 4.99 7.66 4.71 8 4.71C8.35 4.71 8.63 4.99 8.63 5.33V7.38H10.67C11.01 7.38 11.29 7.65 11.29 8C11.29 8.35 11.01 8.62 10.67 8.62H8.63V10.67C8.63 11.01 8.35 11.29 8 11.29C7.66 11.29 7.38 11.01 7.38 10.67ZM15.29 8C15.29 12.03 12.03 15.29 8 15.29C3.97 15.29 0.71 12.03 0.71 8C0.71 3.97 3.97 0.71 8 0.71C12.03 0.71 15.29 3.97 15.29 8Z"
        fill={color}
      />
    </IconWrapper>
  );
}
