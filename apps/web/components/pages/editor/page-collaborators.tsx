/** SPDX-License-Identifier: AGPL-3.0-only */
/** See the LICENSE file for details. */

// plane imports
import { Avatar } from "@makeplane/propel/components/avatar";
import { AvatarGroup } from "@makeplane/propel/components/avatar-group";
import type { TAwarenessUser } from "@plane/editor";
import { getFallbackAvatarInitials } from "@plane/utils";

type Props = {
  collaborators: TAwarenessUser[];
};

export function PageCollaborators(props: Props) {
  const { collaborators } = props;

  if (collaborators.length === 0) return null;

  return (
    <AvatarGroup size="sm">
      {collaborators.map((collaborator) => (
        <Avatar
          key={collaborator.id}
          alt={collaborator.name}
          tooltip={collaborator.name}
          fallback={
            <span
              className="grid size-full place-items-center text-white"
              style={{ backgroundColor: collaborator.color }}
            >
              {getFallbackAvatarInitials(collaborator.name)}
            </span>
          }
        />
      ))}
    </AvatarGroup>
  );
}
