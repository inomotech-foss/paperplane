/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";
import type { TIllustrationAssetProps } from "../helper";

export function EstimateHorizontalStackIllustration({ className }: TIllustrationAssetProps) {
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
          d="M47.62 2.36C46.71 1.89 45.53 1.93 44.25 2.58L9.02 20.54C6.12 22.01 3.77 26.07 3.77 29.59V72.47C3.77 74.43 4.5 75.81 5.64 76.41L2.12 74.62C0.98 74.03 0.25 72.64 0.25 70.68V27.79C0.25 24.27 2.6 20.22 5.5 18.74L40.74 0.79C42.02 0.13 43.2 0.1 44.1 0.57L47.62 2.36Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M47.62 2.36C48.77 2.94 49.49 4.33 49.49 6.29V49.18C49.49 52.7 47.14 56.75 44.25 58.23L9.01 76.18C7.72 76.84 6.55 76.87 5.64 76.41C4.49 75.82 3.77 74.43 3.77 72.47V29.58C3.77 26.06 6.12 22.01 9.02 20.53L44.25 2.58C45.54 1.92 46.72 1.89 47.62 2.36Z"
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
          d="M63 9.15C64.15 9.73 64.87 11.12 64.87 13.09V55.97C64.87 59.5 62.52 63.55 59.62 65.02L24.39 82.98C23.1 83.63 21.92 83.67 21.02 83.2C19.87 82.62 19.15 81.23 19.15 79.26V36.38C19.15 32.85 21.5 28.8 24.39 27.33L59.63 9.37C60.92 8.72 62.09 8.68 63 9.15Z"
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
        d="M78.38 15.95C79.52 16.54 80.25 17.92 80.25 19.89V62.77C80.25 66.3 77.9 70.35 75 71.82L39.76 89.78C38.48 90.44 37.3 90.47 36.4 90C35.25 89.42 34.53 88.03 34.53 86.06V43.18C34.53 39.65 36.88 35.61 39.77 34.13L75.01 16.17C76.3 15.52 77.47 15.49 78.38 15.95Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M56.99 40.08C57.5 39.46 58.08 38.98 58.67 38.68C59.26 38.38 59.84 38.27 60.35 38.37C60.86 38.46 61.29 38.76 61.58 39.24L70.55 53.78C70.84 54.25 71 54.87 71 55.59C71 56.31 70.84 57.1 70.55 57.87C70.26 58.65 69.83 59.38 69.32 60C68.81 60.63 68.23 61.11 67.64 61.41L49.68 70.55C49.09 70.85 48.52 70.95 48 70.86C47.49 70.76 47.06 70.46 46.77 69.98C46.48 69.51 46.32 68.89 46.32 68.17C46.32 67.45 46.48 66.67 46.77 65.9L55.75 42.2C56.05 41.43 56.47 40.7 56.98 40.08H56.99ZM58.67 41.41C58.47 41.51 58.28 41.67 58.11 41.87C57.94 42.08 57.8 42.32 57.7 42.57L48.72 66.26C48.63 66.52 48.57 66.78 48.57 67.02C48.57 67.25 48.63 67.47 48.72 67.62C48.82 67.78 48.96 67.89 49.13 67.92C49.3 67.95 49.49 67.92 49.69 67.81L67.64 58.67C67.84 58.57 68.03 58.41 68.2 58.2C68.38 58 68.52 57.75 68.61 57.49C68.71 57.23 68.76 56.97 68.76 56.74C68.76 56.5 68.71 56.29 68.61 56.13L59.64 41.59C59.55 41.43 59.4 41.33 59.23 41.3C59.06 41.27 58.87 41.3 58.67 41.41Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
