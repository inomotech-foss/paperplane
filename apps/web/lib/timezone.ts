// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { TTimezone, TUserTimezone } from "@plane/api-types";
import { timezoneEnumValues, userTimezoneEnumValues } from "@plane/api-types";

/** Whether the API accepts `value` as a workspace timezone. */
export const isTimezone = (value: unknown): value is TTimezone =>
  timezoneEnumValues.some((timezone) => timezone === value);

/** Whether the API accepts `value` as a user timezone. */
export const isUserTimezone = (value: unknown): value is TUserTimezone =>
  userTimezoneEnumValues.some((timezone) => timezone === value);
