/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "./type";

export function CreateIcon({ className = "text-current", ...rest }: ISvgIcons) {
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
        d="M21 12V19C21 19.53 20.79 20.04 20.41 20.41C20.04 20.79 19.53 21 19 21H5C4.47 21 3.96 20.79 3.59 20.41C3.21 20.04 3 19.53 3 19V5C3 4.47 3.21 3.96 3.59 3.59C3.96 3.21 4.47 3 5 3H12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16 5H22" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 2V8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
