/** SPDX-License-Identifier: AGPL-3.0-only */
/** See the LICENSE file for details. */

import { useEffect, useState } from "react";
// plane imports
import { useCollaboration } from "@plane/editor";
import { Avatar, AvatarGroup } from "@plane/ui";

type TAwarenessUser = {
  id: string;
  name: string;
  color: string;
};

type Props = {
  currentUserId: string;
};

export function PageCollaborators(props: Props) {
  const { currentUserId } = props;
  const { provider } = useCollaboration();
  const [collaborators, setCollaborators] = useState<TAwarenessUser[]>([]);

  useEffect(() => {
    const awareness = provider.awareness;
    if (!awareness) return;

    const updateCollaborators = () => {
      const peersById = new Map<string, TAwarenessUser>();
      awareness.getStates().forEach((state) => {
        const user = (state as { user?: TAwarenessUser } | undefined)?.user;
        if (user?.id && user.id !== currentUserId) {
          peersById.set(user.id, user);
        }
      });
      setCollaborators(Array.from(peersById.values()));
    };

    // Populate immediately in case peers are already connected
    updateCollaborators();
    awareness.on("change", updateCollaborators);

    return () => {
      awareness.off("change", updateCollaborators);
      setCollaborators([]);
    };
  }, [provider, currentUserId]);

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
