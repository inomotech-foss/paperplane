/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "./type";

export function FavoriteFolderIcon({ className = "text-current", color = "#a3a3a3", ...rest }: ISvgIcons) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke={color}
      className={`${className} stroke-2`}
      {...rest}
    >
      <path
        d="M7.33 13.33H2.67C2.31 13.33 1.97 13.19 1.72 12.94C1.47 12.69 1.33 12.35 1.33 12V3.33C1.33 2.98 1.47 2.64 1.72 2.39C1.97 2.14 2.31 2 2.67 2H5.27C5.49 2 5.71 2.05 5.91 2.16C6.1 2.26 6.27 2.41 6.39 2.6L6.93 3.4C7.05 3.58 7.22 3.74 7.41 3.84C7.61 3.95 7.83 4 8.05 4H13.33C13.69 4 14.03 4.14 14.28 4.39C14.53 4.64 14.67 4.98 14.67 5.33V6.33"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.14 8L13 9.76L14.94 10.04L13.54 11.4L13.87 13.33L12.14 12.42L10.4 13.33L10.74 11.4L9.33 10.04L11.27 9.76L12.14 8Z"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
