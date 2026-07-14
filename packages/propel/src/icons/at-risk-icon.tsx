/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "./type";

export function AtRiskIcon({ width = "16", height = "16" }: ISvgIcons) {
  return (
    <svg width={width} height={height} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#clip0_365_7561)">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M2.04 7.33H2.67C3.03 7.33 3.33 7.63 3.33 8C3.33 8.37 3.03 8.67 2.67 8.67H2.04C2.37 11.67 4.91 14 8 14C11.09 14 13.63 11.67 13.96 8.67H13.33C12.97 8.67 12.67 8.37 12.67 8C12.67 7.63 12.97 7.33 13.33 7.33H13.96C13.63 4.33 11.09 2 8 2C4.91 2 2.37 4.33 2.04 7.33ZM0.67 8C0.67 3.95 3.95 0.67 8 0.67C12.05 0.67 15.33 3.95 15.33 8C15.33 12.05 12.05 15.33 8 15.33C3.95 15.33 0.67 12.05 0.67 8ZM8 4.67C8.37 4.67 8.67 4.97 8.67 5.33V8C8.67 8.37 8.37 8.67 8 8.67C7.63 8.67 7.33 8.37 7.33 8V5.33C7.33 4.97 7.63 4.67 8 4.67ZM7.33 10.67C7.33 10.3 7.63 10 8 10H8.01C8.37 10 8.67 10.3 8.67 10.67C8.67 11.03 8.37 11.33 8.01 11.33H8C7.63 11.33 7.33 11.03 7.33 10.67Z"
          fill="#CC7700"
        />
      </g>
      <defs>
        <clipPath id="clip0_365_7561">
          <rect width="16" height="16" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}
