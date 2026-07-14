/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "./type";

export function CalendarAfterIcon({ className = "fill-current", ...rest }: ISvgIcons) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} `} fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
      <g clipPath="url(#clip0_3309_70901)">
        <path
          d="M10.61 17V15.88H14.62V7.81H3.38V11.94H2.25V4.25C2.25 3.95 2.36 3.69 2.59 3.46C2.81 3.24 3.08 3.12 3.38 3.12H4.59V2H5.81V3.12H12.19V2H13.41V3.12H14.62C14.93 3.12 15.19 3.24 15.41 3.46C15.64 3.69 15.75 3.95 15.75 4.25V15.88C15.75 16.18 15.64 16.44 15.41 16.66C15.19 16.89 14.93 17 14.62 17H10.61ZM6 18.24L5.21 17.45L7.33 15.31H0.94V14.19H7.33L5.21 12.05L6 11.26L9.49 14.75L6 18.24ZM3.38 6.69H14.62V4.25H3.38V6.69Z"
          fill="var(--text-color-secondary)"
        />
      </g>
      <defs>
        <clipPath id="clip0_3309_70901">
          <rect width="18" height="18" fill="white" transform="translate(0 0.5)" />
        </clipPath>
      </defs>
    </svg>
  );
}
