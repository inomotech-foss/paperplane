/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "./type";

export function LayerStackIcon({ className = "text-current", ...rest }: ISvgIcons) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} stroke-2`}
      stroke="currentColor"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <path
        d="M19 22H4C3.47 22 2.96 21.81 2.59 21.48C2.21 21.14 2 20.69 2 20.21V11.29C2 10.81 2.21 10.36 2.59 10.02C2.96 9.69 3.47 9.5 4 9.5H20C20.53 9.5 21.04 9.69 21.41 10.02C21.79 10.36 22 10.81 22 11.29V20.21C22 20.69 21.79 21.14 21.41 21.48C21.04 21.81 20.53 22 20 22H19Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 9.5V6.82C4.5 6.54 4.66 6.26 4.94 6.06C5.22 5.86 5.6 5.75 6 5.75H18C18.4 5.75 18.78 5.86 19.06 6.06C19.34 6.26 19.5 6.54 19.5 6.82V9.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 4.5V2.71C7 2.52 7.11 2.34 7.29 2.21C7.48 2.08 7.73 2 8 2H16C16.27 2 16.52 2.08 16.71 2.21C16.89 2.34 17 2.52 17 2.71V4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
