/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function ScopePropertyIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  const clipPathId = React.useId();

  return (
    <IconWrapper color={color} clipPathId={clipPathId} {...rest}>
      <path
        d="M8 0.71C12.03 0.71 15.29 3.97 15.29 8C15.29 12.03 12.03 15.29 8 15.29C3.97 15.29 0.71 12.03 0.71 8C0.71 3.97 3.97 0.71 8 0.71ZM7.38 4V1.99C4.54 2.28 2.28 4.54 1.99 7.38H4C4.35 7.38 4.63 7.65 4.63 8C4.63 8.34 4.35 8.62 4 8.62H1.99C2.28 11.46 4.54 13.72 7.38 14.01V12C7.38 11.65 7.66 11.38 8 11.38C8.35 11.38 8.63 11.65 8.63 12V14.01C11.46 13.72 13.72 11.46 14.01 8.62H12C11.66 8.62 11.38 8.35 11.38 8C11.38 7.65 11.66 7.38 12 7.38H14.01C13.72 4.54 11.46 2.28 8.63 1.99V4C8.63 4.34 8.35 4.62 8 4.62C7.66 4.62 7.38 4.35 7.38 4Z"
        fill={color}
      />
    </IconWrapper>
  );
}
