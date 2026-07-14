/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "./type";

export function BarIcon({ className = "", ...rest }: ISvgIcons) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...rest}>
      <path
        d="M0 12.59C0 11.48 0.9 10.59 2 10.59H3.65C4.75 10.59 5.65 11.48 5.65 12.59V24H0V12.59Z"
        fill="currentColor"
      />
      <path d="M9.18 2C9.18 0.9 10.07 0 11.18 0H12.82C13.93 0 14.82 0.9 14.82 2V24H9.18V2Z" fill="currentColor" />
      <path
        d="M18.35 8.35C18.35 7.25 19.25 6.35 20.35 6.35H22C23.11 6.35 24 7.25 24 8.35V24H18.35V8.35Z"
        fill="currentColor"
      />
    </svg>
  );
}
