/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";
import type { TIllustrationAssetProps } from "../helper";

export function MembersHorizontalStackIllustration({ className }: TIllustrationAssetProps) {
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
          d="M41.6 1.99C40.8 1.59 39.77 1.62 38.65 2.19L7.82 17.9C5.29 19.19 3.23 22.74 3.23 25.82V63.34C3.23 65.06 3.86 66.27 4.87 66.79L1.79 65.22C0.79 64.71 0.15 63.49 0.15 61.77V24.25C0.15 21.16 2.21 17.62 4.74 16.33L35.57 0.62C36.7 0.05 37.73 0.02 38.52 0.43L41.6 1.99Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M41.6 1.99C42.6 2.5 43.24 3.72 43.24 5.44V42.96C43.24 46.05 41.18 49.59 38.65 50.88L7.81 66.59C6.69 67.17 5.66 67.19 4.87 66.79C3.86 66.27 3.23 65.06 3.23 63.34V25.82C3.23 22.73 5.29 19.19 7.82 17.9L38.65 2.19C39.78 1.61 40.81 1.59 41.6 1.99Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M55.06 7.97C54.26 7.56 53.23 7.6 52.11 8.16L21.28 23.88C18.74 25.17 16.68 28.72 16.68 31.8V69.32C16.68 71.04 17.32 72.25 18.32 72.76L15.24 71.2C14.24 70.69 13.61 69.47 13.61 67.75V30.23C13.61 27.14 15.66 23.6 18.2 22.31L49.03 6.6C50.16 6.02 51.18 6 51.98 6.4L55.06 7.97Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M55.06 7.97C56.06 8.48 56.69 9.7 56.69 11.42V48.94C56.69 52.03 54.64 55.57 52.1 56.86L21.27 72.57C20.14 73.14 19.11 73.17 18.32 72.76C17.32 72.25 16.68 71.04 16.68 69.32V31.8C16.68 28.71 18.74 25.17 21.28 23.88L52.11 8.17C53.23 7.59 54.26 7.56 55.06 7.97Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M68.51 13.92C67.71 13.52 66.68 13.55 65.57 14.12L34.73 29.83C32.2 31.12 30.14 34.67 30.14 37.75V75.27C30.14 76.99 30.78 78.2 31.78 78.72L28.7 77.15C27.7 76.64 27.06 75.42 27.06 73.7V36.18C27.06 33.1 29.12 29.55 31.65 28.26L62.49 12.55C63.61 11.98 64.64 11.95 65.43 12.36L68.51 13.92Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M68.51 13.92C69.51 14.43 70.15 15.65 70.15 17.37V54.89C70.15 57.98 68.09 61.52 65.56 62.81L34.73 78.52C33.6 79.1 32.57 79.12 31.78 78.72C30.78 78.21 30.14 76.99 30.14 75.27V37.75C30.14 34.66 32.2 31.12 34.73 29.83L65.57 14.12C66.69 13.54 67.72 13.52 68.51 13.92Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M47.26 51.75C48.52 49.57 50.24 47.83 52.02 46.92C53.81 46 55.52 46 56.78 46.89C58.05 47.79 58.76 49.5 58.76 51.68C58.76 52.33 58.33 53.07 57.79 53.34C57.25 53.61 56.83 53.31 56.83 52.66C56.83 51.11 56.32 49.87 55.42 49.24C54.51 48.59 53.29 48.6 52.01 49.26C50.74 49.91 49.51 51.15 48.61 52.71C47.7 54.27 47.2 56.02 47.2 57.57C47.2 58.22 46.77 58.96 46.24 59.23C45.71 59.5 45.28 59.2 45.28 58.55C45.28 56.37 45.99 53.92 47.26 51.74V51.75Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M52.03 39.88C50.43 40.7 49.14 42.93 49.14 44.87C49.14 46.81 50.43 47.72 52.03 46.91C53.62 46.09 54.91 43.86 54.91 41.92C54.91 39.98 53.62 39.07 52.03 39.88ZM47.21 45.85C47.21 42.61 49.36 38.89 52.02 37.54C54.68 36.19 56.83 37.71 56.83 40.94C56.83 44.17 54.68 47.9 52.02 49.26C49.36 50.61 47.21 49.08 47.21 45.85Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M56.84 37.43C56.84 36.78 57.27 36.04 57.81 35.77C58.92 35.2 59.99 35.21 60.77 35.79C61.55 36.37 61.98 37.46 61.98 38.82C61.98 40.19 61.55 41.73 60.77 43.1C60.73 43.16 60.7 43.22 60.66 43.28C61.11 43.37 61.53 43.55 61.91 43.82C62.99 44.62 63.59 46.14 63.59 48.04C63.59 48.69 63.16 49.44 62.62 49.7C62.09 49.97 61.66 49.67 61.66 49.02C61.66 47.72 61.25 46.69 60.53 46.16C59.8 45.62 58.83 45.61 57.81 46.13C57.28 46.4 56.85 46.09 56.85 45.45C56.85 44.8 57.27 44.05 57.81 43.78C58.4 43.48 58.97 42.9 59.39 42.15C59.81 41.41 60.06 40.55 60.06 39.78C60.06 39.02 59.82 38.42 59.39 38.1C58.97 37.78 58.4 37.78 57.81 38.09C57.28 38.35 56.85 38.05 56.85 37.4L56.84 37.43Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M47.21 42.34C47.21 41.69 46.78 41.39 46.25 41.66C45.13 42.22 44.07 43.32 43.29 44.69C42.51 46.07 42.07 47.61 42.07 48.97C42.07 50.33 42.51 51.43 43.29 52C43.32 52.03 43.36 52.05 43.39 52.08C42.94 52.63 42.52 53.24 42.15 53.9C41.06 55.8 40.46 57.93 40.46 59.83C40.46 60.48 40.89 60.79 41.42 60.52C41.95 60.25 42.38 59.5 42.38 58.85C42.38 57.55 42.8 56.11 43.52 54.83C44.25 53.55 45.22 52.55 46.23 52.03C46.77 51.76 47.19 51.02 47.19 50.37C47.19 49.72 46.77 49.42 46.23 49.68C45.65 49.98 45.08 49.98 44.65 49.67C44.23 49.35 43.98 48.75 43.98 47.99C43.98 47.22 44.23 46.37 44.65 45.63C45.07 44.88 45.65 44.3 46.23 44C46.77 43.73 47.19 42.98 47.19 42.33L47.21 42.34Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
