/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "./type";

export function OnTrackIcon({ width = "16", height = "16" }: ISvgIcons) {
  return (
    <svg width={width} height={height} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#clip0_365_7535)">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M11 2.8C9.81 2.11 8.42 1.86 7.07 2.07C5.71 2.28 4.47 2.96 3.55 3.97C2.63 4.99 2.09 6.3 2.01 7.67C1.93 9.04 2.33 10.39 3.13 11.5C3.94 12.62 5.09 13.42 6.42 13.79C7.74 14.15 9.15 14.04 10.41 13.49C11.66 12.94 12.7 11.98 13.33 10.76C13.96 9.54 14.15 8.14 13.88 6.8C13.81 6.44 14.04 6.09 14.4 6.01C14.76 5.94 15.11 6.17 15.19 6.53C15.52 8.18 15.28 9.89 14.51 11.37C13.74 12.86 12.48 14.04 10.94 14.72C9.41 15.39 7.68 15.51 6.07 15.07C4.45 14.63 3.03 13.64 2.05 12.28C1.07 10.92 0.59 9.27 0.68 7.59C0.77 5.92 1.44 4.32 2.56 3.08C3.69 1.84 5.2 1.01 6.86 0.75C8.52 0.49 10.21 0.81 11.67 1.65C11.99 1.83 12.09 2.24 11.91 2.56C11.73 2.88 11.32 2.98 11 2.8ZM15.14 2.2C15.4 2.46 15.4 2.88 15.14 3.14L8.47 9.8C8.21 10.07 7.79 10.07 7.53 9.8L5.53 7.8C5.27 7.54 5.27 7.12 5.53 6.86C5.79 6.6 6.21 6.6 6.47 6.86L8 8.39L14.2 2.2C14.46 1.93 14.88 1.93 15.14 2.2Z"
          fill="#1FAD40"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8 15.33C7.63 15.33 7.33 15.03x33329 14.67V13.33C7.33 12.97 7.63 12.67 8 12.67C8.37 12.67 8.67 12.97 8.67 13.33V14.67C8.67 15.03 8.37 15.33 8 15.33Z"
          fill="#1FAD40"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8 3.33C7.63 3.33 7.33 3.03 7.33 2.67V1.33C7.33 0.97 7.63 0.67 8 0.67C8.37 0.67 8.67 0.97 8.67 1.33V2.67C8.67 3.03 8.37 3.33 8 3.33Z"
          fill="#1FAD40"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M3.33 8C3.33 8.37 3.03 8.67 2.67 8.67H1.33C0.97 8.67 0.67 8.37 0.67 8C0.67 7.63 0.97 7.33 1.33 7.33H2.67C3.03 7.33 3.33 7.63 3.33 8Z"
          fill="#1FAD40"
        />
      </g>
      <defs>
        <clipPath id="clip0_365_7535">
          <path
            d="M0 2C0 0.9 0.9 0 2 0H14C15.1 0 16 0.9 16 2V14C16 15.1 15.1 16 14 16H2C0.9 16 0 15.1 0 14V2Z"
            fill="white"
          />
        </clipPath>
      </defs>
    </svg>
  );
}
