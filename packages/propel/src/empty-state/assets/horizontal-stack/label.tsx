/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";
import type { TIllustrationAssetProps } from "../helper";

export function LabelHorizontalStackIllustration({ className }: TIllustrationAssetProps) {
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
          d="M47.62 2.39C46.71 1.91 45.53 1.95 44.25 2.61L9.02 20.82C6.12 22.31 3.77 26.43 3.77 29.99V73.47C3.77 75.47 4.5 76.87 5.64 77.47L2.12 75.65C0.98 75.06 0.25 73.65 0.25 71.66V28.18C0.25 24.6 2.6 20.5 5.5 19L40.74 0.79C42.02 0.13 43.2 0.1 44.1 0.57L47.62 2.39Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M47.62 2.39C48.77 2.98 49.49 4.39 49.49 6.38V49.86C49.49 53.43 47.14 57.54 44.25 59.03L9.01 77.24C7.72 77.91 6.55 77.94 5.64 77.47C4.49 76.87 3.77 75.47 3.77 73.47V29.99C3.77 26.42 6.12 22.31 9.02 20.82L44.25 2.61C45.54 1.95 46.72 1.91 47.62 2.39Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M63 9.27C62.09 8.8 60.91 8.84 59.63 9.5L24.39 27.71C21.5 29.2 19.15 33.31 19.15 36.88V80.36C19.15 82.35 19.87 83.75 21.02 84.35L17.5 82.54C16.35 81.95 15.63 80.54 15.63 78.55V35.07C15.63 31.49 17.98 27.39 20.88 25.89L56.11 7.68C57.4 7.02 58.58 6.99 59.48 7.46L63 9.27Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M63 9.27C64.15 9.87 64.87 11.27 64.87 13.27V56.75C64.87 60.32 62.52 64.43 59.63 65.92L24.39 84.13C23.1 84.79 21.92 84.83 21.02 84.35C19.87 83.76 19.15 82.35 19.15 80.36V36.88C19.15 33.31 21.5 29.2 24.39 27.71L59.63 9.5C60.92 8.83 62.09 8.8 63 9.27Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M78.38 16.17C77.47 15.7 76.29 15.74 75.01 16.39L39.77 34.6C36.88 36.1 34.53 40.21 34.53 43.78V87.26C34.53 89.25 35.25 90.65 36.4 91.25L32.88 89.43C31.73 88.84 31.01 87.43 31.01 85.44V41.96C31.01 38.39 33.36 34.28 36.25 32.79L71.49 14.58C72.78 13.91 73.95 13.88 74.86 14.35L78.38 16.17Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M78.38 16.17C79.52 16.76 80.25 18.17 80.25 20.16V63.64C80.25 67.22 77.9 71.32 75 72.82L39.76 91.03C38.48 91.69 37.3 91.72 36.4 91.25C35.25 90.66 34.53 89.25 34.53 87.26V43.78C34.53 40.2 36.88 36.1 39.77 34.6L75.01 16.39C76.3 15.73 77.47 15.7 78.38 16.17Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M49.56 47.87C50.16 46.82 50.98 45.98 51.84 45.54L59.54 41.56C60.39 41.12 61.21 41.11 61.82 41.55L71.16 48.25C71.85 48.75 72.23 49.7 72.23 50.9C72.23 52.1 71.84 53.44 71.16 54.65L64.1 67.02C63.41 68.23 62.48 69.18 61.51 69.68C60.54 70.19 59.61 70.19 58.92 69.71L49.58 63C48.97 62.57 48.63 61.74 48.63 60.68V51.19C48.63 50.13 48.97 48.95 49.58 47.89L49.56 47.87ZM51.84 48.19C51.55 48.33 51.28 48.61 51.08 48.96C50.88 49.31 50.76 49.71 50.76 50.06V59.55C50.76 59.91 50.87 60.19 51.08 60.33L60.42 67.03C60.71 67.23 61.1 67.23 61.5 67.02C61.91 66.81 62.29 66.41 62.58 65.91L69.65 53.56C69.93 53.06 70.09 52.5 70.09 52C70.09 51.51 69.93 51.11 69.65 50.9L60.3 44.2C60.11 44.06 59.83 44.06 59.55 44.2L51.84 48.18L51.84 48.19Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M59.53 51.16C59.53 53.35 58.09 55.88 56.31 56.79C54.54 57.71 53.09 56.68 53.09 54.48C53.09 52.28 54.54 49.76 56.31 48.85C58.09 47.93 59.53 48.96 59.53 51.16Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
