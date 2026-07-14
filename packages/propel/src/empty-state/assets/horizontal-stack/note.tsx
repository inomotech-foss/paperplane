/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";
import type { TIllustrationAssetProps } from "../helper";

export function NoteHorizontalStackIllustration({ className }: TIllustrationAssetProps) {
  return (
    <svg
      width="51"
      height="58"
      viewBox="0 0 51 58"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g opacity="0.2">
        <path
          d="M30.14 1.46C29.57 1.16 28.82 1.19 28.01 1.6L5.68 12.98C3.85 13.91 2.35 16.48 2.35 18.71V45.89C2.35 47.13 2.82 48.01 3.54 48.38L1.31 47.25C0.58 46.88 0.12 46 0.12 44.75V17.58C0.12 15.34 1.61 12.78 3.45 11.84L25.78 0.46C26.59 0.05 27.34 0.03 27.91 0.32L30.14 1.46Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M30.14 1.46C30.87 1.83 31.33 2.71 31.33 3.95V31.13C31.33 33.36 29.84 35.93 28 36.86L5.67 48.24C4.86 48.66 4.11 48.68 3.54 48.38C2.81 48.01 2.35 47.13 2.35 45.89V18.71C2.35 16.48 3.84 13.91 5.68 12.98L28.01 1.6C28.82 1.18 29.57 1.16 30.14 1.46Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M39.89 5.79C39.31 5.5 38.56 5.52 37.76 5.93L15.43 17.31C13.59 18.25 12.1 20.82 12.1 23.05V50.22C12.1 51.47 12.56 52.34 13.29 52.72L11.05 51.58C10.33 51.21 9.87 50.33 9.87 49.09V21.91C9.87 19.68 11.36 17.11 13.2 16.18L35.52 4.8C36.34 4.38 37.09 4.36 37.66 4.66L39.89 5.79Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M39.89 5.79C40.62 6.16 41.08 7.04 41.08 8.29V35.46C41.08 37.7 39.59 40.26 37.75 41.2L15.42 52.58C14.61 52.99 13.86 53.01 13.29 52.72C12.56 52.35 12.1 51.47 12.1 50.22V23.05C12.1 20.81 13.59 18.25 15.43 17.31L37.76 5.93C38.57 5.52 39.31 5.5 39.89 5.79Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M49.63 10.1C49.05 9.8 48.31 9.83 47.5 10.24L25.17 21.62C23.34 22.55 21.84 25.12 21.84 27.35V54.53C21.84 55.77 22.3 56.65 23.03 57.02L20.8 55.89C20.07 55.52 19.61 54.64 19.61 53.39V26.22C19.61 23.98 21.11 21.42 22.94 20.48L45.27 9.1C46.09 8.69 46.83 8.67 47.41 8.96L49.63 10.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M49.63 10.1C50.36 10.47 50.82 11.35 50.82 12.59V39.77C50.82 42 49.33 44.57 47.49 45.5L25.16 56.88C24.35 57.3 23.61 57.32 23.03 57.02C22.3 56.65 21.84 55.77 21.84 54.53V27.35C21.84 25.12 23.34 22.55 25.17 21.62L47.5 10.24C48.31 9.82 49.06 9.8 49.63 10.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M43.01 22.17L31.91 27.82C30.6 28.49 29.54 30.32 29.54 31.92V45.42C29.54 47.01 30.6 47.77 31.91 47.1L40.62 42.66C40.84 42.55 41.04 42.35 41.19 42.09L45.15 35.25C45.3 35 45.38 34.71 45.38 34.45V23.84C45.38 22.25 44.31 21.5 43 22.16L43.01 22.17ZM43.8 33.33L41.42 34.54C40.11 35.21 39.04 37.05 39.04 38.65V41.54L31.91 45.17C31.48 45.39 31.12 45.15 31.12 44.61V31.11C31.12 30.58 31.48 29.97 31.91 29.75L43.01 24.1C43.45 23.87 43.8 24.12 43.8 24.66V33.34V33.33Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
