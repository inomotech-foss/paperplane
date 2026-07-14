/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export const InfoIcon: React.FC<ISvgIcons> = ({ color = "currentColor", ...rest }) => {
  const clipPathId = React.useId();

  return (
    <IconWrapper color={color} clipPathId={clipPathId} {...rest}>
      <path
        d="M14.04 8C14.04 4.66 11.34 1.96 8 1.96C4.66 1.96 1.96 4.66 1.96 8C1.96 11.34 4.66 14.04 8 14.04C11.34 14.04 14.04 11.34 14.04 8ZM7.38 10.67V8C7.38 7.65 7.65 7.38 8 7.38C8.35 7.38 8.62 7.65 8.62 8V10.67C8.62 11.01 8.35 11.29 8 11.29C7.65 11.29 7.38 11.01 7.38 10.67ZM8.01 4.71C8.35 4.71 8.63 4.99 8.63 5.33C8.63 5.68 8.35 5.96 8.01 5.96H8C7.65 5.96 7.38 5.68 7.38 5.33C7.38 4.99 7.65 4.71 8 4.71H8.01ZM15.29 8C15.29 12.03 12.03 15.29 8 15.29C3.97 15.29 0.71 12.03 0.71 8C0.71 3.97 3.97 0.71 8 0.71C12.03 0.71 15.29 3.97 15.29 8Z"
        fill={color}
      />
    </IconWrapper>
  );
};
