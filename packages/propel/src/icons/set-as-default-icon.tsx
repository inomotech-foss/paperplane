/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ISvgIcons } from "./type";

export function SetAsDefaultIcon({ className = "text-current", ...rest }: ISvgIcons) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...rest}
    >
      <path
        d="M7.29 0.62V13.96M12.01 2.58L2.58 12.01M13.96 7.29H0.62M12.01 12.01L2.58 2.58"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
