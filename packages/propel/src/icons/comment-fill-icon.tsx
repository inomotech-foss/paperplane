/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "./type";

export function CommentFillIcon({ className = "text-current", ...rest }: ISvgIcons) {
  return (
    <svg viewBox="0 0 24 24" className={`${className}`} xmlns="http://www.w3.org/2000/svg" {...rest}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.85 2.77C7.22 2.42 9.61 2.25 12 2.25C14.43 2.25 16.82 2.43 19.15 2.77C21.13 3.06 22.5 4.79 22.5 6.74V12.76C22.5 14.71 21.13 16.44 19.15 16.73C17.21 17.01 15.24 17.18 13.23 17.23C13.13 17.24 13.04 17.28 12.96 17.35L8.78 21.53C8.68 21.63 8.54 21.71 8.4 21.73C8.25 21.76 8.1 21.75 7.96 21.69C7.83 21.64 7.71 21.54 7.63 21.42C7.54 21.29 7.5 21.15 7.5 21V17.05C6.61 16.96 5.73 16.86 4.85 16.73C2.87 16.44 1.5 14.71 1.5 12.76V6.74C1.5 4.79 2.87 3.06 4.85 2.77Z"
        fill="currentColor"
      />
    </svg>
  );
}
