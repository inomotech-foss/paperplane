/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { Avatar } from "@makeplane/propel/components/avatar";
import { Badge } from "@makeplane/propel/components/badge";
import { TableActionCell, TableCell, TableRow } from "@makeplane/propel/components/table";
import type { IInstanceUser } from "@plane/types";
import { renderFormattedDate } from "@plane/utils";
// hooks
import { useInstanceUser, useUser } from "@/hooks/store";
// local
import { UserRowMenu } from "./user-row-menu";
import type { TUserRowAction } from "./user-row-menu";
import { UserStatusBadge } from "./user-status-badge";

export type { TUserRowAction };

type Props = {
  userId: string;
  isPossibleDuplicate: boolean;
  onAction: (action: TUserRowAction, user: IInstanceUser) => void;
};

export const UserRow = observer(function UserRow(props: Props) {
  const { userId, isPossibleDuplicate, onAction } = props;
  const { getUserById } = useInstanceUser();
  const { currentUser } = useUser();
  const user = getUserById(userId);

  if (!user) return null;

  const locked = Boolean(user.deleted_at) || currentUser?.id === user.id;
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.display_name;

  return (
    <TableRow>
      <TableCell
        startIcon={<Avatar size="sm" src={user.avatar_url ?? undefined} alt={name} fallback={user.email.slice(0, 1)} />}
      >
        <span className="flex items-center gap-2">
          <span className="truncate">{user.email}</span>
          {isPossibleDuplicate && <Badge size="xs" variant="warning" label="Possible duplicate" />}
        </span>
      </TableCell>
      <TableCell>{name}</TableCell>
      <TableCell>{user.providers.length > 0 ? user.providers.join(", ") : "password"}</TableCell>
      <TableCell>
        <span className="flex items-center gap-1">
          {user.is_instance_admin && <Badge size="xs" variant="brand" label="Instance admin" />}
          {user.is_bot && <Badge size="xs" variant="grey" label="Bot" />}
          <UserStatusBadge user={user} />
        </span>
      </TableCell>
      <TableCell align="end">{user.workspace_count}</TableCell>
      <TableCell>{user.last_login_time ? renderFormattedDate(user.last_login_time) : "Never"}</TableCell>
      <TableActionCell aria-label={`Actions for ${user.email}`} disabled={locked}>
        <UserRowMenu user={user} onAction={onAction} />
      </TableActionCell>
    </TableRow>
  );
});
