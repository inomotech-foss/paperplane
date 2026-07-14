/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function StatePropertyIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  const clipPathId = React.useId();

  return (
    <IconWrapper color={color} clipPathId={clipPathId} {...rest}>
      <path
        d="M14.04 8C14.04 4.66 11.34 1.96 8 1.96C4.66 1.96 1.96 4.66 1.96 8C1.96 11.34 4.66 14.04 8 14.04C11.34 14.04 14.04 11.34 14.04 8ZM11.38 8C11.38 6.14 9.86 4.63 8 4.62C6.14 4.62 4.62 6.14 4.62 8C4.62 9.86 6.14 11.38 8 11.38C9.86 11.37 11.38 9.86 11.38 8ZM12.62 8C12.62 10.55 10.55 12.62 8 12.62C5.45 12.62 3.38 10.55 3.38 8C3.38 5.45 5.45 3.38 8 3.38C10.55 3.38 12.62 5.45 12.62 8ZM15.29 8C15.29 12.03 12.03 15.29 8 15.29C3.97 15.29 0.71 12.03 0.71 8C0.71 3.97 3.97 0.71 8 0.71C12.03 0.71 15.29 3.97 15.29 8Z"
        fill={color}
      />
    </IconWrapper>
  );
}
