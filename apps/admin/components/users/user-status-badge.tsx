/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Badge } from "@makeplane/propel/components/badge";
import type { IInstanceUser } from "@plane/types";

export function UserStatusBadge({ user }: { user: IInstanceUser }) {
  if (user.deleted_at) return <Badge size="xs" variant="danger" label={user.merged_into ? "Merged" : "Deleted"} />;
  if (user.is_active) return <Badge size="xs" variant="success" label="Active" />;
  return <Badge size="xs" variant="neutral" label="Deactivated" />;
}
