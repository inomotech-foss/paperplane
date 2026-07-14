/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";
import type { TIllustrationAssetProps } from "../helper";

export function EpicHorizontalStackIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg
      width="81"
      height="92"
      viewBox="0 0 81 92"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g opacity="0.2">
        <path
          d="M47.62 2.36C46.71 1.89 45.53 1.93 44.25 2.58L9.02 20.54C6.12 22.01 3.77 26.07 3.77 29.59V72.47C3.77 74.43 4.49 75.81 5.64 76.41L2.12 74.61C0.98 74.03 0.25 72.64 0.25 70.68V27.79C0.25 24.27 2.6 20.22 5.5 18.74L40.73 0.79C42.02 0.13 43.2 0.1 44.1 0.57L47.62 2.36Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M47.62 2.36C48.77 2.94 49.49 4.33 49.49 6.29V49.18C49.49 52.7 47.14 56.75 44.25 58.23L9.01 76.19C7.72 76.84 6.55 76.87 5.64 76.41C4.49 75.82 3.77 74.43 3.77 72.47V29.59C3.77 26.06 6.12 22.01 9.02 20.54L44.25 2.58C45.54 1.92 46.71 1.89 47.62 2.36Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M63 9.15C62.09 8.68 60.91 8.72 59.63 9.37L24.39 27.33C21.5 28.8 19.15 32.86 19.15 36.38V79.26C19.15 81.23 19.87 82.61 21.02 83.2L17.5 81.41C16.35 80.82 15.63 79.44 15.63 77.47V34.59C15.63 31.06 17.98 27.01 20.88 25.54L56.11 7.58C57.4 6.92 58.57 6.89 59.48 7.36L63 9.15Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M63 9.15C64.15 9.73 64.87 11.12 64.87 13.09V55.97C64.87 59.5 62.52 63.54 59.62 65.02L24.39 82.98C23.1 83.63 21.93 83.66 21.02 83.2C19.87 82.62 19.15 81.23 19.15 79.26V36.38C19.15 32.85 21.5 28.8 24.39 27.33L59.63 9.37C60.92 8.72 62.09 8.68 63 9.15Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M78.38 15.95C77.46 15.49 76.29 15.53 75.01 16.17L39.77 34.13C36.88 35.61 34.53 39.66 34.53 43.18V86.06C34.53 88.03 35.25 89.41 36.4 90L32.88 88.21C31.73 87.63 31.01 86.24 31.01 84.27V41.39C31.01 37.86 33.36 33.81 36.25 32.34L71.49 14.38C72.78 13.73 73.95 13.69 74.86 14.16L78.38 15.95Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M78.38 15.95C79.52 16.53 80.25 17.92 80.25 19.89V62.77C80.25 66.3 77.9 70.35 75 71.82L39.77 89.78C38.48 90.43 37.3 90.47 36.4 90C35.25 89.42 34.53 88.03 34.53 86.06V43.18C34.53 39.65 36.88 35.61 39.77 34.13L75.01 16.17C76.3 15.52 77.47 15.49 78.38 15.95Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M73.49 50.91V54.75C73.49 55.14 73.36 55.58 73.16 55.96C72.93 56.35 72.65 56.66 72.34 56.81L47.17 69.64C46.54 69.96 46.03 69.56 46.03 68.74V62.63L53.66 46.06C54.08 45.29 54.58 44.6 55.19 44.29C55.8 43.98 56.29 44.17 56.71 44.51L63.31 53.89L66.16 49.33C66.58 48.55 67.17 47.95 67.77 47.63C68.38 47.31 68.97 47.34 69.38 47.68L73.49 50.91V50.91Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
