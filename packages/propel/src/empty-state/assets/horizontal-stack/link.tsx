/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";
import type { TIllustrationAssetProps } from "../helper";

export function LinkHorizontalStackIllustration({ className }: TIllustrationAssetProps) {
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
          d="M30.14 1.46C29.57 1.16 28.82 1.19 28.01 1.6L5.68 12.98C3.85 13.91 2.35 16.48 2.35 18.71V45.89C2.35 47.13 2.81 48.01 3.54 48.38L1.31 47.25C0.58 46.88 0.12 46 0.12 44.75V17.58C0.12 15.34 1.61 12.78 3.45 11.84L25.78 0.46C26.59 0.05 27.34 0.03 27.91 0.32L30.14 1.46Z"
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
        fillRule="evenodd"
        clipRule="evenodd"
        d="M32.49 37.2C31.93 38.16 31.62 39.23 31.62 40.18C31.62 41.13 31.93 41.89 32.49 42.28C33.05 42.67 33.8 42.67 34.58 42.27C35.35 41.87 36.11 41.11 36.66 40.16L37.7 38.36C37.99 37.86 38.46 37.62 38.75 37.83C39.04 38.03 39.04 38.6 38.75 39.1L37.7 40.9C36.88 42.33 35.75 43.47 34.58 44.07C33.4 44.67 32.27 44.68 31.45 44.09C30.61 43.5 30.15 42.37 30.15 40.94C30.15 39.51 30.61 37.9 31.45 36.47L32.49 34.67C32.78 34.17 33.24 33.93 33.53 34.14C33.83 34.34 33.83 34.91 33.53 35.41L32.49 37.21V37.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M35.62 30.52C35.33 30.32 35.33 29.75 35.62 29.25L36.66 27.45C37.49 26.02 38.62 24.88 39.8 24.28C40.97 23.68 42.09 23.67 42.92 24.26C43.76 24.85 44.22 25.98 44.22 27.41C44.22 28.84 43.76 30.45 42.92 31.88L41.88 33.68C41.59 34.18 41.12 34.42 40.84 34.21C40.55 34.01 40.55 33.44 40.84 32.94L41.88 31.14C42.44 30.19 42.74 29.11 42.74 28.16C42.74 27.21 42.44 26.45 41.88 26.06C41.33 25.67 40.58 25.67 39.8 26.07C39.01 26.47 38.26 27.23 37.71 28.19L36.66 29.99C36.38 30.49 35.91 30.72 35.62 30.52V30.52Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M34.58 38.68C34.28 38.47 34.28 37.91 34.58 37.41L38.75 30.2C39.04 29.7 39.51 29.47 39.8 29.67C40.09 29.88 40.09 30.44 39.8 30.94L35.62 38.15C35.33 38.64 34.87 38.88 34.58 38.68Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
