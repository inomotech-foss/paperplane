/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";
import type { TIllustrationAssetProps } from "../helper";

export function UpdateHorizontalStackIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg
      width="72"
      height="81"
      viewBox="0 0 72 81"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g opacity="0.2">
        <path
          d="M42.46 2.92C41.66 2.51 40.63 2.54 39.51 3.11L8.67 18.83C6.14 20.12 4.08 23.67 4.08 26.75V64.27C4.08 65.99 4.71 67.2 5.72 67.72L2.64 66.15C1.64 65.64 1 64.42 1 62.71V25.18C1 22.09 3.06 18.55 5.59 17.26L36.43 1.54C37.55 0.97 38.58 0.94 39.38 1.35L42.46 2.92Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M42.46 2.92C43.46 3.43 44.09 4.64 44.09 6.36V43.89C44.09 46.98 42.03 50.52 39.5 51.81L8.66 67.53C7.54 68.1 6.51 68.13 5.72 67.72C4.71 67.21 4.08 65.99 4.08 64.27V26.75C4.08 23.66 6.14 20.12 8.67 18.83L39.51 3.11C40.63 2.54 41.66 2.51 42.46 2.92Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M55.91 8.9C55.11 8.5 54.08 8.53 52.96 9.1L22.13 24.81C19.59 26.1 17.54 29.65 17.54 32.73V70.26C17.54 71.98 18.17 73.19 19.17 73.7L16.09 72.14C15.09 71.63 14.46 70.41 14.46 68.69V31.16C14.46 28.08 16.51 24.54 19.05 23.25L49.89 7.53C51.01 6.96 52.04 6.93 52.83 7.34L55.91 8.9Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M55.91 8.9C56.91 9.41 57.55 10.63 57.55 12.35V49.88C57.55 52.96 55.49 56.51 52.96 57.8L22.12 73.51C21 74.08 19.97 74.11 19.17 73.7C18.17 73.19 17.54 71.98 17.54 70.26V32.73C17.54 29.65 19.59 26.1 22.13 24.81L52.96 9.1C54.09 8.52 55.12 8.5 55.91 8.9Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M69.36 14.85C68.56 14.44 67.53 14.48 66.42 15.04L35.58 30.76C33.04 32.05 30.99 35.6 30.99 38.68V76.2C30.99 77.92 31.62 79.13 32.62 79.65L29.54 78.08C28.54 77.57 27.91 76.36 27.91 74.64V37.11C27.91 34.02 29.97 30.48 32.5 29.19L63.34 13.47C64.46 12.9 65.49 12.87 66.28 13.28L69.36 14.85Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M69.36 14.85C70.36 15.36 71 16.58 71 18.29V55.82C71 58.91 68.94 62.45 66.41 63.74L35.57 79.46C34.45 80.03 33.42 80.06 32.62 79.65C31.62 79.14 30.99 77.92 30.99 76.2V38.68C30.99 35.59 33.04 32.05 35.58 30.76L66.42 15.04C67.54 14.47 68.57 14.44 69.36 14.85Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M48.65 44.35C51.17 39.11 55.11 34.57 59.55 32.31C59.91 32.12 60.2 32.33 60.2 32.77C60.2 38.17 58.12 44.02 54.87 48.74C55.39 52.4 53.19 57.22 49.96 59.49C49.65 59.7 49.34 59.9 49.03 60.05C48.66 60.24 48.37 60.03 48.37 59.59V55.19C47.52 54.8 46.75 54.25 46.08 53.56L42.46 55.41C42.1 55.59 41.81 55.39 41.81 54.94C41.81 50.97 44.45 46.4 47.72 44.73C48.03 44.57 48.34 44.44 48.65 44.35ZM53.63 40.92C52.54 41.47 51.66 43 51.66 44.33C51.66 45.65 52.54 46.27 53.63 45.72C54.71 45.17 55.6 43.64 55.6 42.32C55.6 40.99 54.71 40.37 53.63 40.92Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
      />
      <path
        d="M45.09 56.45C45.38 56.04 45.45 55.5 45.22 55.26C45.01 55.02 44.6 55.16 44.31 55.57C42.94 57.51 42.24 59.92 42.51 61.84C42.55 62.16 42.77 62.31 43.06 62.22C44.74 61.68 46.44 59.98 47.45 57.8C47.68 57.33 47.62 56.86 47.34 56.73C47.05 56.61 46.64 56.88 46.42 57.35C46.42 57.35 46.41 57.37 46.41 57.38C45.78 58.71 44.81 59.8 43.77 60.33C43.77 59.02 44.29 57.59 45.09 56.45Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
      />
    </svg>
  );
}
