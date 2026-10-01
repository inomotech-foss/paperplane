/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { GitMerge, Trash2, UserCheck, UserX } from "lucide-react";
// plane imports
import { Avatar } from "@makeplane/propel/components/avatar";
import { Badge } from "@makeplane/propel/components/badge";
import { Icon } from "@makeplane/propel/components/icon";
import { MenuContent, MenuItem } from "@makeplane/propel/components/menu";
import { TableActionCell, TableCell, TableRow } from "@makeplane/propel/components/table";
import type { IInstanceUser } from "@plane/types";
import { renderFormattedDate } from "@plane/utils";
// hooks
import { useInstanceUser, useUser } from "@/hooks/store";

export type TUserRowAction = "deactivate" | "reactivate" | "merge" | "delete";

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

  const isSelf = currentUser?.id === user.id;
  const isDeleted = Boolean(user.deleted_at);
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
          {isDeleted ? (
            <Badge size="xs" variant="danger" label={user.merged_into ? "Merged" : "Deleted"} />
          ) : user.is_active ? (
            <Badge size="xs" variant="success" label="Active" />
          ) : (
            <Badge size="xs" variant="neutral" label="Deactivated" />
          )}
        </span>
      </TableCell>
      <TableCell align="end">{user.workspace_count}</TableCell>
      <TableCell>{user.last_login_time ? renderFormattedDate(user.last_login_time) : "Never"}</TableCell>
      <TableActionCell aria-label={`Actions for ${user.email}`} disabled={isDeleted || isSelf}>
        <MenuContent side="bottom" align="end">
          {user.is_active ? (
            <MenuItem label="Deactivate" icon={<Icon icon={UserX} />} onClick={() => onAction("deactivate", user)} />
          ) : (
            <MenuItem
              label="Reactivate"
              icon={<Icon icon={UserCheck} />}
              onClick={() => onAction("reactivate", user)}
            />
          )}
          {!user.is_bot && (
            <MenuItem label="Merge into..." icon={<Icon icon={GitMerge} />} onClick={() => onAction("merge", user)} />
          )}
          {!user.is_bot && (
            <MenuItem
              label="Delete"
              variant="danger"
              icon={<Icon icon={Trash2} />}
              onClick={() => onAction("delete", user)}
            />
          )}
        </MenuContent>
      </TableActionCell>
    </TableRow>
  );
});
