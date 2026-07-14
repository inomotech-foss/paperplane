/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "./type";

export function SuspendedUserIcon({ className, ...rest }: ISvgIcons) {
  return (
    <svg viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...rest}>
      <g clipPath="url(#clip0_806_120890)">
        <path
          d="M3 13C3 12.3 3.18 11.62 3.53 11.02C3.87 10.41 4.37 9.91 4.97 9.55C5.57 9.2 6.25 9.01 6.95 9C7.64 8.99 8.33 9.16 8.94 9.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7 9C8.38 9 9.5 7.88 9.5 6.5C9.5 5.12 8.38 4 7 4C5.62 4 4.5 5.12 4.5 6.5C4.5 7.88 5.62 9 7 9Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M10.5 11L13 13.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 11L10.5 13.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <defs>
        <clipPath id="clip0_806_120890">
          <path
            d="M2 4.5C2 3.4 2.9 2.5 4 2.5H12C13.1 2.5 14 3.4 14 4.5V12.5C14 13.6 13.1 14.5 12 14.5H4C2.9 14.5 2 13.6 2 12.5V4.5Z"
            fill="white"
          />
        </clipPath>
      </defs>
    </svg>
  );
}
