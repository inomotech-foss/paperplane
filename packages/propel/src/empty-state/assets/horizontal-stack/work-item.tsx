/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";
import type { TIllustrationAssetProps } from "../helper";

export function WorkItemHorizontalStackIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg
      width="71"
      height="80"
      viewBox="0 0 71 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g opacity="0.2">
        <path
          d="M41.6 1.99C40.8 1.59 39.77 1.62 38.65 2.19L7.82 17.9C5.29 19.19 3.23 22.74 3.23 25.82V63.34C3.23 65.06 3.86 66.27 4.87 66.79L1.79 65.22C0.79 64.71 0.15 63.49 0.15 61.77V24.25C0.15 21.17 2.21 17.62 4.74 16.33L35.57 0.62C36.7 0.05 37.73 0.02 38.52 0.43L41.6 1.99Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M41.6 1.99C42.6 2.5 43.24 3.72 43.24 5.44V42.96C43.24 46.05 41.18 49.59 38.65 50.88L7.81 66.59C6.69 67.17 5.66 67.19 4.87 66.79C3.86 66.28 3.23 65.06 3.23 63.34V25.82C3.23 22.73 5.29 19.19 7.82 17.9L38.65 2.19C39.78 1.61 40.81 1.59 41.6 1.99Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M55.06 7.94C54.26 7.53 53.23 7.56 52.11 8.13L21.28 23.84C18.74 25.14 16.68 28.68 16.68 31.76V69.29C16.68 71.01 17.32 72.21 18.32 72.73L15.24 71.16C14.24 70.65 13.61 69.44 13.61 67.72V30.2C13.61 27.11 15.66 23.57 18.2 22.28L49.03 6.56C50.16 5.99 51.18 5.96 51.98 6.37L55.06 7.94Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M55.06 7.94C56.06 8.45 56.69 9.66 56.69 11.38V48.91C56.69 51.99 54.64 55.53 52.1 56.82L21.27 72.54C20.14 73.11 19.11 73.14 18.32 72.73C17.32 72.22 16.68 71.01 16.68 69.29V31.76C16.68 28.68 18.74 25.14 21.28 23.84L52.11 8.13C53.23 7.56 54.26 7.53 55.06 7.94Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M68.51 13.88C67.71 13.47 66.68 13.51 65.57 14.07L34.73 29.79C32.2 31.08 30.14 34.63 30.14 37.71V75.23C30.14 76.95 30.78 78.16 31.78 78.68L28.7 77.11C27.7 76.6 27.06 75.38 27.06 73.66V36.14C27.06 33.05 29.12 29.51 31.65 28.22L62.49 12.51C63.61 11.93 64.64 11.91 65.43 12.31L68.51 13.88Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M68.51 13.88C69.51 14.39 70.15 15.61 70.15 17.33V54.85C70.15 57.94 68.09 61.48 65.56 62.77L34.73 78.48C33.6 79.06 32.57 79.08 31.78 78.68C30.78 78.17 30.14 76.95 30.14 75.23V37.71C30.14 34.62 32.2 31.08 34.73 29.79L65.57 14.07C66.69 13.5 67.72 13.47 68.51 13.88Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M52.69 39.99C52.88 40.41 53.29 40.56 53.78 40.32C54.44 39.99 54.99 39.04 55 38.2V36.67C55.01 36.17 54.82 35.8 54.48 35.68C54.16 35.57 53.74 35.72 53.37 36.09L45.54 43.84C45.07 44.3 44.76 45.01 44.76 45.64V56.19C44.76 56.71 44.98 57.09 45.34 57.18C45.7 57.27 46.15 57.06 46.52 56.63L47.64 55.33C48.23 54.65 48.46 53.62 48.15 53.04C47.95 52.66 47.57 52.57 47.17 52.74V45.46L52.69 40V39.99Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M47.88 37.92C48.06 38.34 48.48 38.49 48.97 38.25C49.63 37.92 50.18 36.98 50.18 36.14V34.61C50.2 34.11 50 33.74 49.67 33.62C49.34 33.5 48.93 33.65 48.55 34.02L40.72 41.77C40.26 42.24 39.95 42.95 39.95 43.58V54.13C39.95 54.65 40.17 55.03 40.53 55.12C40.89 55.21 41.34 55 41.71 54.57L42.83 53.27C43.42 52.59 43.65 51.56 43.34 50.98C43.14 50.6 42.76 50.5 42.36 50.67V43.4L47.88 37.94V37.92Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M60.33 48.98C60.33 49.6 60.03 50.32 59.56 50.78L51.74 58.53C51.36 58.9 50.95 59.05 50.63 58.93C50.3 58.81 50.1 58.45 50.1 57.96V47.41C50.1 46.79 50.4 46.07 50.87 45.61L58.7 37.85C59.08 37.49 59.49 37.33 59.81 37.45C60.14 37.57 60.34 37.94 60.34 38.43V48.97L60.33 48.98ZM57.93 41.86L52.51 47.22V54.54L57.92 49.18V41.86H57.93Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
