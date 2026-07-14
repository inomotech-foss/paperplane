/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "./type";

export function LayersIcon({ className = "text-current", ...rest }: ISvgIcons) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} stroke-2`}
      stroke="currentColor"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <g clipPath="url(#clip0_7258_81938)">
        <path d="M16.6 6.7L16.61 5.17L6.86 8.92L6.86 19.42L9 18.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12.1 3.7L12.11 2.17L2.36 5.92L2.36 16.42L4.5 15.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21.74 17.95L21.75 7.44L12 11.19L12 21.69L21.74 17.95Z" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <defs>
        <clipPath id="clip0_7258_81938">
          <rect width="24" height="24" fill="white" transform="translate(24) rotate(90)" />
        </clipPath>
      </defs>
    </svg>
  );
}
