/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ISvgIcons } from "./type";

export function ActivityIcon({ className = "text-current", ...rest }: ISvgIcons) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...rest}
    >
      <g clipPath="url(#clip0_15681_9387)">
        <path
          d="M14.67 8H13.01C12.72 8 12.44 8.09 12.21 8.27C11.97 8.45 11.81 8.69 11.73 8.97L10.16 14.55C10.15 14.58 10.13 14.61 10.1 14.63C10.07 14.65 10.04 14.67 10 14.67C9.96 14.67 9.93 14.65 9.9 14.63C9.87 14.61 9.85 14.58 9.84 14.55L6.16 1.45C6.15 1.42 6.13 1.39 6.1 1.37C6.07 1.35 6.04 1.33 6 1.33C5.96 1.33 5.93 1.35 5.9 1.37C5.87 1.39 5.85 1.42 5.84 1.45L4.27 7.03C4.19 7.31 4.03 7.55 3.8 7.73C3.57 7.9 3.28 8 2.99 8H1.33"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <defs>
        <clipPath id="clip0_15681_9387">
          <rect width="16" height="16" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}
