/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "./type";

export function UserActivityIcon({ className = "text-current", ...rest }: ISvgIcons) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} stroke-2`}
      stroke="currentColor"
      fill="none"
      strokeWidth="1.5"
      xmlns="http://www.w3.org/2000/svg"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d="M10.5 13C12.99 13 15 10.99 15 8.5C15 6.01 12.99 4 10.5 4C8.01 4 6 6.01 6 8.5C6 10.99 8.01 13 10.5 13Z" />
      <path d="M13.91 13.59C12.84 13.1 11.66 12.89 10.49 12.97C9.31 13.06 8.18 13.44 7.19 14.08C6.21 14.72 5.4 15.59 4.84 16.63C4.28 17.66 3.99 18.82 4 20" />
      <path d="M21 16.5H19.6L18.2 20L16.8 13L15.4 16.5H14" />
    </svg>
  );
}
