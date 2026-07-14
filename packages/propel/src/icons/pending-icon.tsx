/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "./type";

export function PendingState({ width = "10", height = "11", className, color = "#455068" }: ISvgIcons) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 3C7.03 3 3 7.03 3 12C3 16.97 7.03 21 12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3ZM1 12C1 5.92 5.92 1 12 1C18.08 1 23 5.92 23 12C23 18.08 18.08 23 12 23C5.92 23 1 18.08 1 12Z"
        fill={color}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 5C12.55 5 13 5.45 13 6V11.38L16.45 13.11C16.94 13.35 17.14 13.95 16.89 14.45C16.65 14.94 16.05 15.14 15.55 14.89L11.55 12.89C11.21 12.72 11 12.38 11 12V6C11 5.45 11.45 5 12 5Z"
        fill={color}
      />
    </svg>
  );
}
