/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "./type";

export function PlannedState({ width = "10", height = "11", className }: ISvgIcons) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 12 13"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g clipPath="url(#clip0_3180_28635)">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M7.12 4.7C7.2 4.89 7.38 5.02 7.6 5.02C7.89 5.02 8.13 4.78 8.13 4.48L8.13 3.93C8.13 3.75 8.05 3.58 7.91 3.48C7.76 3.38 7.58 3.35 7.42 3.42L3.98 4.78C3.78 4.86 3.64 5.06 3.64 5.28L3.64 9.09C3.64 9.28 3.74 9.45 3.9 9.55C4.05 9.65 4.25 9.66 4.41 9.57L4.91 9.31C5.16 9.17 5.26 8.84 5.13 8.57C5.04 8.4 4.87 8.3 4.7 8.28L4.7 5.66L7.12 4.7Z"
          fill="#455068"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M5 3.07C5.09 3.26 5.27 3.39 5.48 3.39C5.77 3.39 6.01 3.15 6.01 2.85L6.02 2.3C6.02 2.12 5.94 1.95 5.79 1.85C5.65 1.75 5.46 1.72 5.3 1.79L1.87 3.15C1.66 3.23 1.53 3.43 1.53 3.65L1.53 7.46C1.53 7.65 1.62 7.82 1.78 7.92C1.94 8.02 2.14 8.03 2.3 7.94L2.79 7.68C3.05 7.54 3.15 7.21 3.01 6.94C2.93 6.77 2.76 6.66 2.58 6.65L2.58 4.03L5 3.07Z"
          fill="#455068"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M10.47 9.35C10.47 9.57 10.34 9.77 10.13 9.85L6.7 11.21C6.54 11.28 6.36 11.26 6.21 11.15C6.07 11.05 5.98 10.88 5.98 10.71L5.98 6.9C5.98 6.68 6.12 6.47 6.32 6.39L9.76 5.04C9.92 4.97 10.1 4.99 10.25 5.09C10.39 5.2 10.48 5.36 10.48 5.54L10.47 9.35ZM9.42 6.33L7.04 7.27L7.04 9.91L9.42 8.97L9.42 6.33Z"
          fill="#455068"
        />
      </g>
      <defs>
        <clipPath id="clip0_3180_28635">
          <rect width="12" height="12" fill="white" transform="translate(0 0.5)" />
        </clipPath>
      </defs>
    </svg>
  );
}
