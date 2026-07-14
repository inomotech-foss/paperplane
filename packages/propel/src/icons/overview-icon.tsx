/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "./type";

export function OverviewIcon({ className = "text-current", ...rest }: ISvgIcons) {
  return (
    <svg viewBox="0 0 12 12" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0.5 1C0.5 0.87 0.55 0.74 0.65 0.65C0.74 0.55 0.87 0.5 1 0.5H1.5C7.02 0.5 11.5 4.98 11.5 10.5V11C11.5 11.13 11.45 11.26 11.35 11.35C11.26 11.45 11.13 11.5 11 11.5H10.5C10.37 11.5 10.24 11.45 10.15 11.35C10.05 11.26 10 11.13 10 11V10.5C10 5.81 6.19 2 1.5 2H1C0.87 2 0.74 1.95 0.65 1.85C0.55 1.76 0.5 1.63 0.5 1.5V1ZM0.5 5.5C0.5 5.37 0.55 5.24 0.65 5.15C0.74 5.05 0.87 5 1 5H1.5C2.22 5 2.94 5.14 3.6 5.42C4.27 5.7 4.88 6.1 5.39 6.61C5.9 7.12 6.3 7.73 6.58 8.4C6.86 9.06 7 9.78 7 10.5V11C7 11.13 6.95 11.26 6.85 11.35C6.76 11.45 6.63 11.5 6.5 11.5H6C5.87 11.5 5.74 11.45 5.65 11.35C5.55 11.26 5.5 11.13 5.5 11V10.5C5.5 9.44 5.08 8.42 4.33 7.67C3.58 6.92 2.56 6.5 1.5 6.5H1C0.87 6.5 0.74 6.45 0.65 6.35C0.55 6.26 0.5 6.13 0.5 6V5.5ZM0.5 10.5C0.5 10.23 0.61 9.98 0.79 9.79C0.98 9.61 1.23 9.5 1.5 9.5C1.77 9.5 2.02 9.61 2.21 9.79C2.39 9.98 2.5 10.23 2.5 10.5C2.5 10.77 2.39 11.02 2.21 11.21C2.02 11.39 1.77 11.5 1.5 11.5C1.23 11.5 0.98 11.39 0.79 11.21C0.61 11.02 0.5 10.77 0.5 10.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
