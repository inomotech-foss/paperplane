/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "../type";

export function ContrastIcon({ className = "text-current", ...rest }: ISvgIcons) {
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
        d="M12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 18C13.59 18 15.12 17.37 16.24 16.24C17.37 15.12 18 13.59 18 12C18 10.41 17.37 8.88 16.24 7.76C15.12 6.63 13.59 6 12 6V18Z"
        fill="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
