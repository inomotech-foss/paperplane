/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";
import type { TIllustrationAssetProps } from "../helper";

export function StateHorizontalStackIllustration({ className }: TIllustrationAssetProps) {
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
          d="M41.58 1.97C40.78 1.56 39.75 1.6 38.63 2.16L7.8 17.87C5.26 19.17 3.2 22.71 3.2 25.79V63.32C3.2 65.04 3.84 66.24 4.84 66.76L1.76 65.19C0.76 64.68 0.12 63.47 0.12 61.75V24.23C0.12 21.14 2.18 17.6 4.72 16.31L35.55 0.59C36.67 0.02 37.7 -0.01 38.5 0.4L41.58 1.97Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M41.58 1.97C42.58 2.48 43.21 3.69 43.21 5.41V42.94C43.21 46.02 41.16 49.56 38.62 50.86L7.79 66.57C6.66 67.14 5.63 67.17 4.84 66.76C3.84 66.25 3.2 65.04 3.2 63.32V25.79C3.2 22.71 5.26 19.17 7.8 17.87L38.63 2.16C39.75 1.59 40.78 1.56 41.58 1.97Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M55.03 7.91C54.23 7.5 53.2 7.54 52.08 8.11L21.25 23.82C18.72 25.11 16.66 28.66 16.66 31.74V69.26C16.66 70.98 17.3 72.19 18.3 72.71L15.22 71.14C14.22 70.63 13.58 69.41 13.58 67.69V30.17C13.58 27.08 15.64 23.54 18.17 22.25L49.01 6.54C50.13 5.97 51.16 5.94 51.95 6.34L55.03 7.91Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M55.03 7.91C56.03 8.42 56.67 9.64 56.67 11.36V48.88C56.67 51.97 54.61 55.51 52.08 56.8L21.24 72.51C20.12 73.09 19.09 73.11 18.3 72.71C17.3 72.2 16.66 70.98 16.66 69.26V31.74C16.66 28.65 18.72 25.11 21.25 23.82L52.08 8.11C53.21 7.53 54.24 7.5 55.03 7.91Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M68.49 13.86C67.69 13.46 66.66 13.49 65.54 14.06L34.71 29.77C32.17 31.06 30.12 34.61 30.12 37.69V75.21C30.12 76.93 30.75 78.14 31.75 78.66L28.67 77.09C27.67 76.58 27.04 75.36 27.04 73.65V36.12C27.04 33.04 29.09 29.49 31.63 28.2L62.46 12.49C63.59 11.92 64.62 11.89 65.41 12.3L68.49 13.86Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M68.49 13.86C69.49 14.37 70.13 15.59 70.13 17.31V54.83C70.13 57.92 68.07 61.46 65.53 62.75L34.7 78.46C33.58 79.04 32.55 79.07 31.75 78.66C30.75 78.15 30.12 76.93 30.12 75.21V37.69C30.12 34.6 32.17 31.06 34.71 29.77L65.54 14.06C66.67 13.48 67.69 13.46 68.49 13.86Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M51.11 32.82C44.37 36.26 38.91 45.7 38.91 53.9C38.91 62.1 44.37 65.97 51.11 62.54C57.86 59.1 63.32 49.66 63.32 41.46C63.32 33.26 57.85 29.39 51.11 32.82ZM46.09 53.51L43.94 56.01C43.32 54.93 42.98 53.51 42.98 51.83C42.98 50.14 43.32 48.37 43.94 46.67L46.09 46.98C45.66 48.17 45.42 49.41 45.42 50.59C45.42 51.78 45.66 52.76 46.09 53.52V53.51ZM51.11 57.58C49.72 58.28 48.42 58.53 47.27 58.37L48.43 55.17C49.23 55.28 50.13 55.12 51.11 54.62C52.09 54.12 53 53.36 53.8 52.44L54.95 54.47C53.81 55.79 52.5 56.88 51.11 57.59V57.58ZM53.8 40.19C53 40.08 52.09 40.24 51.11 40.74C50.13 41.24 49.23 42 48.43 42.92L47.27 40.89C48.41 39.57 49.72 38.48 51.11 37.77C52.5 37.07 53.8 36.82 54.95 36.98L53.8 40.18V40.19ZM58.3 48.69L56.14 48.38C56.57 47.2 56.81 45.96 56.81 44.77C56.81 43.59 56.57 42.6 56.14 41.85L58.3 39.35C58.91 40.42 59.26 41.84 59.26 43.53C59.26 45.21 58.91 46.99 58.3 48.69Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
