/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "./type";

export function DropdownIcon({ className = "text-current", ...rest }: ISvgIcons) {
  return (
    <svg
      viewBox="0 0 7 5"
      className={`${className} stroke-2`}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <path d="M2.77 4.02L0.46 1.79C0.16 1.5 0.1 1.17 0.26 0.8C0.42 0.43 0.71 0.25 1.13 0.25H5.73C6.15 0.25 6.44 0.43 6.6 0.8C6.76 1.17 6.69 1.5 6.4 1.79L4.08 4.02C3.99 4.11 3.88 4.18 3.78 4.23C3.67 4.27 3.55 4.29 3.43 4.29C3.3 4.29 3.19 4.27 3.08 4.23C2.97 4.18 2.87 4.11 2.77 4.02Z" />
    </svg>
  );
}
