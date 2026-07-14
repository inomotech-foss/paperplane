/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";
import type { TIllustrationAssetProps } from "../helper";

export function TokenHorizontalStackIllustration({ className }: TIllustrationAssetProps) {
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
          d="M47.62 2.36C46.71 1.89 45.53 1.93 44.25 2.58L9.02 20.54C6.12 22.01 3.77 26.07 3.77 29.59V72.47C3.77 74.44 4.49 75.82 5.64 76.41L2.12 74.62C0.98 74.03 0.25 72.64 0.25 70.68V27.8C0.25 24.27 2.6 20.22 5.5 18.74L40.74 0.79C42.03 0.13 43.2 0.1 44.11 0.57L47.63 2.36H47.62Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M47.62 2.36C48.77 2.94 49.49 4.33 49.49 6.29V49.18C49.49 52.7 47.14 56.75 44.25 58.23L9.01 76.19C7.72 76.84 6.55 76.87 5.64 76.41C4.5 75.82 3.77 74.43 3.77 72.47V29.59C3.77 26.06 6.12 22.01 9.02 20.54L44.25 2.58C45.54 1.92 46.72 1.89 47.62 2.36Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M63 9.2C62.09 8.73 60.91 8.77 59.63 9.42L24.39 27.38C21.5 28.85 19.15 32.91 19.15 36.43V79.31C19.15 81.27 19.87 82.66 21.02 83.25L17.5 81.46C16.35 80.87 15.63 79.48 15.63 77.52V34.63C15.63 31.11 17.98 27.06 20.88 25.58L56.11 7.63C57.4 6.97 58.58 6.94 59.48 7.4L63 9.2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M63 9.2C64.15 9.78 64.87 11.17 64.87 13.13V56.02C64.87 59.54 62.52 63.59 59.62 65.07L24.39 83.03C23.1 83.68 21.92 83.71 21.02 83.25C19.87 82.66 19.15 81.27 19.15 79.31V36.43C19.15 32.9 21.5 28.85 24.39 27.38L59.63 9.42C60.92 8.76 62.09 8.73 63 9.2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M78.38 15.99C77.46 15.53 76.29 15.56 75.01 16.21L39.77 34.17C36.88 35.65 34.53 39.7 34.53 43.22V86.11C34.53 88.07 35.25 89.45 36.4 90.04L32.88 88.25C31.73 87.67 31.01 86.28 31.01 84.31V41.43C31.01 37.9 33.36 33.85 36.25 32.38L71.49 14.42C72.78 13.77 73.95 13.73 74.86 14.2L78.38 15.99Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M78.38 15.99C79.52 16.57 80.25 17.96 80.25 19.93V62.81C80.25 66.34 77.9 70.39 75 71.86L39.76 89.82C38.48 90.48 37.3 90.51 36.4 90.04C35.25 89.46 34.53 88.07 34.53 86.1V43.22C34.53 39.69 36.88 35.65 39.77 34.17L75.01 16.21C76.3 15.56 77.47 15.52 78.38 15.99Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M53.17 71.79L50.18 73.31C49.08 73.87 48.18 73.24 48.18 71.9V69.27C48.18 68.29 48.5 67.22 49.06 66.24L55.43 55.24C55.07 53.7 55.14 51.83 55.62 49.9C56.97 44.47 61.25 39.77 65.15 39.44C67.03 39.28 68.56 40.15 69.42 41.9C70.29 43.65 70.41 46.06 69.76 48.69C68.47 53.84 64.56 58.32 60.84 59.06L60.45 59.73C59.88 60.71 59.13 61.46 58.33 61.87L58.16 61.96V63.18C58.16 64.52 57.27 66.06 56.16 66.62L55.17 67.13V68.34C55.17 69.69 54.27 71.23 53.17 71.79ZM62.69 42.61C60.42 43.77 58.29 46.58 57.51 49.74C57.11 51.36 57.11 52.92 57.51 54.13C57.64 54.51 57.54 55.04 57.27 55.51L50.47 67.25C50.28 67.57 50.18 67.93 50.18 68.26V70.89L53.17 69.37V68.15C53.17 66.81 54.06 65.27 55.17 64.71L56.16 64.2V62.99C56.16 61.64 57.05 60.1 58.16 59.54L58.33 59.45C58.59 59.32 58.85 59.06 59.03 58.73L59.85 57.33C60.11 56.86 60.52 56.55 60.88 56.52C63.74 56.27 66.87 52.83 67.86 48.85C68.34 46.91 68.26 45.15 67.62 43.87C66.98 42.59 65.87 41.94 64.49 42.07C63.89 42.12 63.29 42.31 62.69 42.61H62.69Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M63.65 47.03C63.92 46.89 64.15 47.05 64.15 47.39C64.15 47.73 63.92 48.1 63.65 48.25C63.37 48.39 63.15 48.23 63.15 47.89C63.15 47.55 63.37 47.17 63.65 47.03Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M63.65 49.46C62.82 49.88 62.15 49.41 62.15 48.4C62.15 47.4 62.82 46.24 63.65 45.82C64.48 45.4 65.15 45.88 65.15 46.88C65.15 47.88 64.48 49.04 63.65 49.46ZM63.65 47.03C63.37 47.17 63.15 47.56 63.15 47.89C63.15 48.22 63.37 48.38 63.65 48.25C63.92 48.11 64.15 47.72 64.15 47.39C64.15 47.05 63.92 46.9 63.65 47.03Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
