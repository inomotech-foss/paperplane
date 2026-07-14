/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function IntakeIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  const clipPathId = React.useId();

  return (
    <IconWrapper color={color} clipPathId={clipPathId} {...rest}>
      <path
        d="M7.38 4.31C7.38 3.35 7.36 3.1 7.12 2.77C7.07 2.7 6.92 2.56 6.69 2.42C6.46 2.28 6.27 2.21 6.19 2.2C5.92 2.16 5.79 2.18 5.7 2.2C5.58 2.23 5.46 2.29 5.21 2.42C3.28 3.43 1.96 5.45 1.96 7.78C1.96 11.12 4.66 13.82 8 13.82C11.34 13.82 14.04 11.12 14.04 7.78C14.04 5.55 12.83 3.59 11.02 2.55C10.72 2.37 10.62 1.99 10.79 1.69C10.97 1.39 11.35 1.29 11.65 1.47C13.82 2.73 15.29 5.08 15.29 7.78C15.29 11.81 12.03 15.07 8 15.07C3.97 15.07 0.71 11.81 0.71 7.78C0.71 4.97 2.3 2.53 4.63 1.31C4.86 1.2 5.1 1.06 5.38 0.99C5.68 0.91 5.98 0.91 6.35 0.96C6.69 1 7.05 1.17 7.34 1.35C7.63 1.52 7.95 1.77 8.14 2.04C8.64 2.75 8.63 3.43 8.63 4.31V8.94L10.23 7.34C10.47 7.1 10.86 7.1 11.11 7.34C11.35 7.58 11.35 7.98 11.11 8.22L8.44 10.89C8.32 11.01 8.17 11.07 8 11.07C7.83 11.07 7.68 11.01 7.56 10.89L4.89 8.22C4.65 7.98 4.65 7.58 4.89 7.34C5.14 7.1 5.53 7.1 5.78 7.34L7.38 8.94V4.31Z"
        fill={color}
      />
    </IconWrapper>
  );
}
