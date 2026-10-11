// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { TIssueActivity } from "@plane/types";

export type TPropertyChange =
  | { kind: "set"; property: string; value: string }
  | { kind: "cleared"; property: string }
  | { kind: "moved"; from: string; to: string; value: string }
  | { kind: "removed"; property: string; value: string };

type TPropertyActivity = Pick<TIssueActivity, "old_identifier" | "new_identifier" | "old_value" | "new_value">;

/**
 * What a custom property activity did. `old_identifier` is the property the value was on and
 * `new_identifier` the one it is on now, empty when a type change removed the value.
 */
export const describePropertyChange = (
  activity: TPropertyActivity,
  nameOf: (propertyId: string | undefined) => string
): TPropertyChange => {
  const source = nameOf(activity.old_identifier);
  if (!activity.new_identifier) return { kind: "removed", property: source, value: activity.old_value ?? "" };
  if (activity.new_identifier !== activity.old_identifier)
    return { kind: "moved", from: source, to: nameOf(activity.new_identifier), value: activity.new_value ?? "" };
  if (!activity.new_value) return { kind: "cleared", property: source };
  return { kind: "set", property: source, value: activity.new_value };
};
