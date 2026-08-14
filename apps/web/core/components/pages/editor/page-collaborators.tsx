/** SPDX-License-Identifier: AGPL-3.0-only */
/** See the LICENSE file for details. */

// plane imports
import type { TAwarenessUser } from "@plane/editor";
import { Avatar, AvatarGroup } from "@plane/ui";

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
          name={collaborator.name}
          fallbackBackgroundColor={collaborator.color}
          fallbackTextColor="#ffffff"
        />
      ))}
    </AvatarGroup>
  );
}
