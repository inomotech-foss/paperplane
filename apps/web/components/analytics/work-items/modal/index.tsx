/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { observer } from "mobx-react";
// plane package imports
import { ModalPortal } from "@plane/blocks/portal";
import type { ICycle, IModule, IProject } from "@plane/types";
// plane web components
import { WorkItemsModalMainContent } from "./content";
import { WorkItemsModalHeader } from "./header";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  projectDetails?: IProject | undefined;
  cycleDetails?: ICycle | undefined;
  moduleDetails?: IModule | undefined;
};

export const WorkItemsModal = observer(function WorkItemsModal(props: Props) {
  const { isOpen, onClose, projectDetails, moduleDetails, cycleDetails } = props;
  const [fullScreen, setFullScreen] = useState(false);

  const handleClose = () => {
    setFullScreen(false);
    onClose();
  };

  return (
    <ModalPortal
      isOpen={isOpen}
      onClose={handleClose}
      width={fullScreen ? "full" : "three-quarter"}
      position="right"
      fullScreen={fullScreen}
      showOverlay={false}
      onOutsideClick={handleClose}
    >
      <div
        className={`flex h-full flex-col overflow-hidden border-subtle bg-surface-1 text-left ${
          fullScreen ? "rounded-lg border" : "border-l"
        }`}
      >
        <WorkItemsModalHeader
          fullScreen={fullScreen}
          handleClose={handleClose}
          setFullScreen={setFullScreen}
          title={projectDetails?.name ?? ""}
          cycle={cycleDetails}
          module={moduleDetails}
        />
        <WorkItemsModalMainContent
          fullScreen={fullScreen}
          projectDetails={projectDetails}
          cycleDetails={cycleDetails}
          moduleDetails={moduleDetails}
        />
      </div>
    </ModalPortal>
  );
});
