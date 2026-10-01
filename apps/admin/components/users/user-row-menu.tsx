/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { GitMerge, Trash2, UserCheck, UserX } from "lucide-react";
// plane imports
import { Icon } from "@makeplane/propel/components/icon";
import { MenuContent, MenuItem } from "@makeplane/propel/components/menu";
import type { IInstanceUser } from "@plane/types";

export type TUserRowAction = "deactivate" | "reactivate" | "merge" | "delete";

type Props = {
  user: IInstanceUser;
  onAction: (action: TUserRowAction, user: IInstanceUser) => void;
};

export function UserRowMenu({ user, onAction }: Props) {
  return (
    <MenuContent side="bottom" align="end">
      {user.is_active ? (
        <MenuItem label="Deactivate" icon={<Icon icon={UserX} />} onClick={() => onAction("deactivate", user)} />
      ) : (
        <MenuItem label="Reactivate" icon={<Icon icon={UserCheck} />} onClick={() => onAction("reactivate", user)} />
      )}
      {!user.is_bot && (
        <>
          <MenuItem label="Merge into..." icon={<Icon icon={GitMerge} />} onClick={() => onAction("merge", user)} />
          <MenuItem
            label="Delete"
            variant="danger"
            icon={<Icon icon={Trash2} />}
            onClick={() => onAction("delete", user)}
          />
        </>
      )}
    </MenuContent>
  );
}
