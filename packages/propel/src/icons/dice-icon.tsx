/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "./type";

export function DiceIcon({ className = "text-current", ...rest }: ISvgIcons) {
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
        d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.78 7H7.22C7.1 7 7 7.1 7 7.22V8.78C7 8.9 7.1 9 7.22 9H8.78C8.9 9 9 8.9 9 8.78V7.22C9 7.1 8.9 7 8.78 7Z"
        fill="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.78 15H7.22C7.1 15 7 15.1 7 15.22V16.78C7 16.9 7.1 17 7.22 17H8.78C8.9 17 9 16.9 9 16.78V15.22C9 15.1 8.9 15 8.78 15Z"
        fill="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.78 7H15.22C15.1 7 15 7.1 15 7.22V8.78C15 8.9 15.1 9 15.22 9H16.78C16.9 9 17 8.9 17 8.78V7.22C17 7.1 16.9 7 16.78 7Z"
        fill="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.78 15H15.22C15.1 15 15 15.1 15 15.22V16.78C15 16.9 15.1 17 15.22 17H16.78C16.9 17 17 16.9 17 16.78V15.22C17 15.1 16.9 15 16.78 15Z"
        fill="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
