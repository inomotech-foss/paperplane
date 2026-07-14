/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "./type";

export function StickyNoteIcon({ width = "17", height = "17", className, color }: ISvgIcons) {
  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox="0 0 17 17"
      fill={"currentColor"}
      xmlns="http://www.w3.org/2000/svg"
      style={{ color }}
    >
      <path
        d="M11.92 16.08H2.75C2.31 16.08 1.88 15.91 1.57 15.6C1.26 15.28 1.08 14.86 1.08 14.42V2.75C1.08 2.31 1.26 1.88 1.57 1.57C1.88 1.26 2.31 1.08 2.75 1.08H14.42C14.86 1.08 15.28 1.26 15.6 1.57C15.91 1.88 16.08 2.31 16.08 2.75V11.92L11.92 16.08Z"
        style={{ opacity: 0.5 }}
        fill="currentColor"
      />
      <path
        d="M11.08 16.08V12.75C11.08 12.31 11.26 11.88 11.57 11.57C11.88 11.26 12.31 11.08 12.75 11.08H16.08"
        style={{ opacity: 0.5 }}
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1.28 15.89C1.67 16.28 2.2 16.5 2.75 16.5H11.92C12.03 16.5 12.13 16.46 12.21 16.38L16.38 12.21C16.46 12.13 16.5 12.03 16.5 11.92V2.75C16.5 2.2 16.28 1.67 15.89 1.28C15.5 0.89 14.97 0.67 14.42 0.67H2.75C2.2 0.67 1.67 0.89 1.28 1.28C0.89 1.67 0.67 2.2 0.67 2.75V14.42C0.67 14.97 0.89 15.5 1.28 15.89ZM15.67 11.5V11.74L11.74 15.67H11.5V12.75C11.5 12.42 11.63 12.1 11.87 11.87C12.1 11.63 12.42 11.5 12.75 11.5H15.67ZM10.67 15.67V12.75C10.67 12.2 10.89 11.67 11.28 11.28C11.67 10.89 12.2 10.67 12.75 10.67H15.67V2.75C15.67 2.42 15.54 2.1 15.3 1.87C15.07 1.63 14.75 1.5 14.42 1.5H2.75C2.42 1.5 2.1 1.63 1.87 1.87C1.63 2.1 1.5 2.42 1.5 2.75V14.42C1.5 14.75 1.63 15.07 1.87 15.3C2.1 15.53 2.42 15.67 2.75 15.67H10.67Z"
        fill="currentColor"
      />
      <path
        d="M11.08 12.75C11.05 13.27 11.08 16.08 11.08 16.08H11.91L16.08 11.92V11.08H12.75C11.5 11.08 11.11 12.23 11.08 12.75Z"
        fill="currentColor"
      />
    </svg>
  );
}
