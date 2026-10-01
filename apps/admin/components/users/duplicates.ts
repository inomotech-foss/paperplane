/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IInstanceUser } from "@plane/types";

const normalise = (value: string) => value.trim().toLowerCase();

/** Ids of users sharing an email local part or display name with another loaded user. */
export function findPossibleDuplicates(users: IInstanceUser[]): Set<string> {
  const byKey = new Map<string, string[]>();
  users.forEach((user) => {
    if (user.deleted_at || user.is_bot) return;
    const localPart = normalise(user.email.split("@")[0] ?? "");
    const displayName = normalise(user.display_name);
    [localPart && `email:${localPart}`, displayName && `name:${displayName}`].forEach((key) => {
      if (!key) return;
      byKey.set(key, [...(byKey.get(key) ?? []), user.id]);
    });
  });
  const duplicates = new Set<string>();
  byKey.forEach((ids) => {
    if (new Set(ids).size > 1) ids.forEach((id) => duplicates.add(id));
  });
  return duplicates;
}
