/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "./type";

export function AiIcon({ width = "16", height = "16", className, color = "currentColor" }: ISvgIcons) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 16 16"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g clipPath="url(#clip0_888_35571)">
        <path
          d="M14.21 0H1.79C0.8 0 0 0.8 0 1.79V14.21C0 15.2 0.8 16 1.79 16H14.21C15.2 16 16 15.2 16 14.21V1.79C16 0.8 15.2 0 14.21 0H14.21ZM13.1 11.53C13.1 12.4 12.4 13.1 11.53 13.1H4.47C3.6 13.1 2.9 12.4 2.9 11.53V4.47C2.9 3.6 3.6 2.9 4.47 2.9H11.53C12.4 2.9 13.1 3.6 13.1 4.47V11.53Z"
          fill={color}
        />
        <path
          d="M9.61 4.94H6.39C5.59 4.94 4.94 5.59 4.94 6.39V9.61C4.94 10.41 5.59 11.06 6.39 11.06H9.61C10.41 11.06 11.06 10.41 11.06 9.61V6.39C11.06 5.59 10.41 4.94 9.61 4.94Z"
          fill={color}
        />
      </g>
      <defs>
        <clipPath id="clip0_888_35571">
          <rect width="16" height="16" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}
