/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export function FilterIcon({ color = "currentColor", ...rest }: ISvgIcons) {
  const clipPathId = React.useId();

  return (
    <IconWrapper color={color} clipPathId={clipPathId} {...rest}>
      <path
        d="M9.98 11.35C10.32 11.35 10.6 11.63 10.6 11.97C10.6 12.32 10.32 12.6 9.98 12.6H5.98C5.63 12.6 5.35 12.32 5.35 11.97C5.35 11.63 5.63 11.35 5.98 11.35H9.98ZM11.98 7.35C12.32 7.35 12.6 7.63 12.6 7.97C12.6 8.32 12.32 8.6 11.98 8.6H3.98C3.63 8.6 3.35 8.32 3.35 7.97C3.35 7.63 3.63 7.35 3.98 7.35H11.98ZM13.98 3.35C14.32 3.35 14.6 3.63 14.6 3.97C14.6 4.32 14.32 4.6 13.98 4.6H1.98C1.63 4.6 1.35 4.32 1.35 3.97C1.35 3.63 1.63 3.35 1.98 3.35H13.98Z"
        fill={color}
      />
    </IconWrapper>
  );
}
