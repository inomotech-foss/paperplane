/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function UserCirclePropertyIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  const clipPathId = React.useId();

  return (
    <IconWrapper color={color} clipPathId={clipPathId} {...rest}>
      <path
        d="M14.04 8C14.04 4.66 11.34 1.96 8 1.96C4.66 1.96 1.96 4.66 1.96 8C1.96 9.51 2.51 10.89 3.43 11.95C4.03 11.19 4.96 10.71 6 10.71H10C11.04 10.71 11.97 11.19 12.57 11.95C13.49 10.89 14.04 9.51 14.04 8ZM6 11.96C5.32 11.96 4.71 12.29 4.34 12.81C5.36 13.58 6.62 14.04 8 14.04C9.37 14.04 10.64 13.58 11.66 12.81C11.29 12.29 10.68 11.96 10 11.96H6ZM10.04 6.33C10.04 5.21 9.13 4.29 8 4.29C6.87 4.29 5.96 5.21 5.96 6.33C5.96 7.46 6.87 8.38 8 8.38C9.13 8.37 10.04 7.46 10.04 6.33ZM15.29 8C15.29 12.03 12.03 15.29 8 15.29C3.97 15.29 0.71 12.03 0.71 8C0.71 3.97 3.97 0.71 8 0.71C12.03 0.71 15.29 3.97 15.29 8ZM11.29 6.33C11.29 8.15 9.82 9.62 8 9.62C6.18 9.62 4.71 8.15 4.71 6.33C4.71 4.52 6.18 3.04 8 3.04C9.82 3.04 11.29 4.52 11.29 6.33Z"
        fill={color}
      />
    </IconWrapper>
  );
}
