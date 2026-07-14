/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "./type";

export function PhotoFilterIcon({ className = "text-current", ...rest }: ISvgIcons) {
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
      <path
        d="M19 3L18.58 4.29C18.56 4.36 18.52 4.42 18.47 4.47C18.42 4.52 18.36 4.55 18.29 4.58L17 5L18.29 5.42C18.36 5.44 18.42 5.48 18.47 5.53C18.52 5.58 18.55 5.64 18.58 5.71L19 7L19.42 5.71C19.44 5.64 19.48 5.58 19.53 5.53C19.58 5.48 19.64 5.45 19.71 5.42L21 5L19.71 4.58C19.64 4.56 19.58 4.52 19.53 4.47C19.48 4.42 19.45 4.36 19.42 4.29L19 3Z"
        fill="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 9L11.37 10.93C11.33 11.03 11.28 11.12 11.2 11.2C11.13 11.27 11.04 11.33 10.94 11.36L9 12L10.93 12.63C11.03 12.67 11.12 12.72 11.2 12.8C11.27 12.87 11.33 12.96 11.36 13.06L12 15L12.63 13.07C12.67 12.97 12.72 12.88 12.8 12.8C12.87 12.73 12.96 12.67 13.06 12.64L15 12L13.07 11.37C12.97 11.33 12.88 11.28 12.8 11.2C12.73 11.13 12.67 11.04 12.64 10.94L12 9Z"
        fill="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
