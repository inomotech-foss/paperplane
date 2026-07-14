/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import { IconWrapper } from "../icon-wrapper";
import type { ISvgIcons } from "../type";

export const CloseCircleFilledIcon: React.FC<ISvgIcons> = ({ color = "currentColor", ...rest }) => {
  const clipPathId = React.useId();

  return (
    <IconWrapper color={color} clipPathId={clipPathId} {...rest}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 0.67C3.95 0.67 0.67 3.95 0.67 8C0.67 12.05 3.95 15.33 8 15.33C12.05 15.33 15.33 12.05 15.33 8C15.33 3.95 12.05 0.67 8 0.67ZM10.47 5.53C10.73 5.79 10.73 6.21 10.47 6.47L8.94 8L10.47 9.53C10.73 9.79 10.73 10.21 10.47 10.47C10.21 10.73 9.79 10.73 9.53 10.47L8 8.94L6.47 10.47C6.21 10.73 5.79 10.73 5.53 10.47C5.27 10.21 5.27 9.79 5.53 9.53L7.06 8L5.53 6.47C5.27 6.21 5.27 5.79 5.53 5.53C5.79 5.27 6.21 5.27 6.47 5.53L8 7.06L9.53 5.53C9.79 5.27 10.21 5.27 10.47 5.53Z"
        fill={color}
      />
    </IconWrapper>
  );
};
