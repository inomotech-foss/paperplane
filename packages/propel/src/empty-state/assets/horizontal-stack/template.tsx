/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";
import type { TIllustrationAssetProps } from "../helper";

export function TemplateHorizontalStackIllustration({ className }: TIllustrationAssetProps) {
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
          d="M47.63 2.39C46.71 1.91 45.54 1.95 44.26 2.61L9.02 20.82C6.12 22.31 3.77 26.43 3.77 29.99V73.47C3.77 75.47 4.5 76.87 5.64 77.47L2.12 75.65C0.98 75.06 0.25 73.65 0.25 71.66V28.18C0.25 24.6 2.6 20.5 5.5 19L40.74 0.79C42.03 0.13 43.2 0.1 44.11 0.57L47.63 2.39Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M47.63 2.39C48.77 2.98 49.5 4.39 49.5 6.38V49.86C49.5 53.43 47.15 57.54 44.25 59.03L9.01 77.24C7.72 77.91 6.55 77.94 5.64 77.47C4.5 76.87 3.77 75.47 3.77 73.47V29.99C3.77 26.42 6.12 22.31 9.02 20.82L44.26 2.61C45.55 1.95 46.72 1.91 47.63 2.39Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M63.01 9.32C62.09 8.85 60.92 8.89 59.64 9.55L24.4 27.75C21.5 29.25 19.15 33.36 19.15 36.93V80.41C19.15 82.4 19.88 83.8 21.02 84.4L17.5 82.59C16.36 81.99 15.63 80.59 15.63 78.59V35.11C15.63 31.54 17.98 27.43 20.88 25.94L56.12 7.73C57.41 7.07 58.58 7.03 59.49 7.51L63.01 9.32Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M63.01 9.32C64.15 9.91 64.88 11.32 64.88 13.31V56.79C64.88 60.37 62.53 64.47 59.63 65.97L24.39 84.18C23.1 84.84 21.93 84.87 21.02 84.4C19.88 83.81 19.15 82.4 19.15 80.41V36.93C19.15 33.35 21.5 29.25 24.4 27.75L59.64 9.55C60.92 8.88 62.1 8.85 63.01 9.32Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M78.38 16.21C77.46 15.74 76.29 15.78 75.01 16.43L39.77 34.64C36.87 36.14 34.52 40.25 34.52 43.82V87.3C34.52 89.29 35.25 90.69 36.39 91.29L32.87 89.47C31.73 88.88 31 87.47 31 85.48V42C31 38.43 33.35 34.32 36.25 32.83L71.49 14.62C72.78 13.95 73.95 13.92 74.86 14.39L78.38 16.21Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M78.38 16.21C79.52 16.8 80.25 18.21 80.25 20.2V63.68C80.25 67.26 77.9 71.36 75 72.86L39.76 91.07C38.47 91.73 37.3 91.76 36.39 91.29C35.25 90.7 34.52 89.29 34.52 87.3V43.82C34.52 40.24 36.87 36.14 39.77 34.64L75.01 16.43C76.3 15.77 77.47 15.74 78.38 16.21Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M59.13 41.37L55.45 50.5L62.78 46.71L59.13 41.38V41.37ZM59.06 38.19C59.4 37.99 59.73 37.91 60.03 37.95C60.33 37.99 60.59 38.15 60.77 38.39L60.78 38.41L65.03 44.62C65.22 44.87 65.34 45.23 65.35 45.63C65.38 46.06 65.3 46.54 65.14 47.01C64.97 47.48 64.73 47.94 64.42 48.33C64.11 48.71 63.77 49.02 63.41 49.2L54.9 53.6C54.55 53.79 54.2 53.87 53.9 53.83C53.59 53.78 53.32 53.6 53.14 53.3C52.96 53.02 52.88 52.62 52.88 52.18C52.89 51.73 53 51.25 53.19 50.78L57.46 40.21C57.63 39.78 57.86 39.37 58.13 39.02C58.42 38.65 58.75 38.36 59.09 38.17L59.06 38.19Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M47.63 63.04C47.63 61.47 48.65 59.67 49.93 59.02L55.67 56.05C56.94 55.39 57.97 56.13 57.97 57.7V64.79C57.97 66.35 56.94 68.15 55.67 68.81L49.93 71.78C48.65 72.43 47.63 71.7 47.63 70.13V63.04ZM55.67 58.88L49.93 61.85V68.94L55.67 65.97V58.88Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M65.44 53.83C63.85 54.65 62.57 56.9 62.57 58.86C62.57 60.82 63.85 61.74 65.44 60.93C67.02 60.11 68.31 57.86 68.31 55.9C68.31 53.94 67.02 53.02 65.44 53.83ZM60.27 60.05C60.27 56.53 62.58 52.47 65.44 50.99C68.3 49.52 70.61 51.18 70.61 54.7C70.61 58.22 68.3 62.28 65.44 63.76C62.58 65.23 60.27 63.58 60.27 60.05Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
