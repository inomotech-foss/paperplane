/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "./type";

export function GitlabIcon({ width = "24", height = "24", className, color }: ISvgIcons) {
  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clipPath="url(#clip0_282_232)">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M10 0C4.47 0 0 4.47 0 10C0 14.43 2.86 18.16 6.84 19.49C7.34 19.57 7.53 19.27 7.53 19.01C7.53 18.77 7.51 17.99 7.51 17.15C5 17.61 4.35 16.54 4.15 15.97C4.04 15.69 3.55 14.8 3.12 14.56C2.77 14.38 2.27 13.91 3.11 13.9C3.9 13.89 4.46 14.62 4.65 14.93C5.55 16.44 6.99 16.01 7.56 15.75C7.65 15.1 7.91 14.66 8.2 14.41C5.97 14.16 3.65 13.3 3.65 9.47C3.65 8.39 4.04 7.49 4.67 6.79C4.58 6.54 4.22 5.51 4.78 4.14C4.78 4.14 5.61 3.88 7.53 5.16C8.32 4.94 9.18 4.83 10.03 4.83C10.88 4.83 11.72 4.94 12.53 5.16C14.44 3.86 15.28 4.14 15.28 4.14C15.82 5.51 15.47 6.54 15.38 6.79C16.01 7.49 16.4 8.38 16.4 9.47C16.4 13.31 14.06 14.16 11.84 14.41C12.2 14.72 12.51 15.32 12.51 16.26C12.51 17.6 12.5 18.68 12.5 19.01C12.5 19.27 12.69 19.59 13.19 19.49C15.17 18.82 16.9 17.54 18.12 15.84C19.34 14.14 20 12.1 20 10C20 4.47 15.53 0 10 0Z"
          fill={color ? color : "var(--text-color-secondary)"}
        />
      </g>
      <defs>
        <clipPath id="clip0_282_232">
          <rect width={width} height={height} />
        </clipPath>
      </defs>
    </svg>
  );
}
