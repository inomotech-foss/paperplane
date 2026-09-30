/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { CloseOutline } from "@makeplane/propel/icons";
import { Avatar } from "@makeplane/propel/components/avatar";
// helpers
import { cn, getFileURL } from "@plane/utils";
// hooks
import { useMember } from "@/hooks/store/use-member";

export type TAppliedMembersFiltersProps = {
  handleRemove: (val: string) => void;
  values: string[];
  editable: boolean | undefined;
};

type Props = TAppliedMembersFiltersProps & {
  chipClassName: string;
};

export const AppliedMemberChips = observer(function AppliedMemberChips(props: Props) {
  const { handleRemove, values, editable, chipClassName } = props;
  // store hooks
  const {
    workspace: { getWorkspaceMemberDetails },
  } = useMember();

  return (
    <>
      {values.map((memberId) => {
        const memberDetails = getWorkspaceMemberDetails(memberId)?.member;

        if (!memberDetails) return null;

        return (
          <div key={memberId} className={cn("flex items-center gap-1 rounded-sm bg-layer-1 text-11", chipClassName)}>
            <Avatar
              alt={memberDetails.display_name}
              fallback={memberDetails.display_name?.[0]?.toUpperCase()}
              src={getFileURL(memberDetails.avatar_url)}
              size="2xs"
            />
            <span className="normal-case">{memberDetails.display_name}</span>
            {editable && (
              <button
                type="button"
                className="grid place-items-center text-tertiary hover:text-secondary"
                onClick={() => handleRemove(memberId)}
              >
                <CloseOutline height={10} width={10} />
              </button>
            )}
          </div>
        );
      })}
    </>
  );
});
