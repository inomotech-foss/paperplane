/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export const CheckCircleFilledIcon: React.FC<ISvgIcons> = ({ color = "currentColor", ...rest }) => {
  const clipPathId = React.useId();

  return (
    <IconWrapper color={color} clipPathId={clipPathId} {...rest}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 0.67C3.95 0.67 0.67 3.95 0.67 8C0.67 12.05 3.95 15.33 8 15.33C12.05 15.33 15.33 12.05 15.33 8C15.33 3.95 12.05 0.67 8 0.67ZM11.47 6.47C11.73 6.21 11.73 5.79 11.47 5.53C11.21 5.27 10.79 5.27 10.53 5.53L7 9.06L5.47 7.53C5.21 7.27 4.79 7.27 4.53 7.53C4.27 7.79 4.27 8.21 4.53 8.47L6.53 10.47C6.79 10.73 7.21 10.73 7.47 10.47L11.47 6.47Z"
        fill={color}
      />
    </IconWrapper>
  );
};
