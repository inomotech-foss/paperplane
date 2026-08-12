/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { Button } from "@plane/propel/button";
import { PageIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { ICustomSearchSelectOption } from "@plane/types";
import { CustomSearchSelect, EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { getPageName } from "@plane/utils";
// components
import { SwitcherLabel } from "@/components/common/switcher-label";
// hooks
import type { EPageStoreType } from "@/hooks/store";
import { usePageStore } from "@/hooks/store";
// store
import type { TPageInstance } from "@/store/pages/base-page";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  page: TPageInstance;
  storeType: EPageStoreType;
};

export const MovePageModal = observer(function MovePageModal(props: Props) {
  const { isOpen, onClose, page, storeType } = props;
  // states
  const [selectedParentId, setSelectedParentId] = useState<string | null>(page.parent ?? null);
  const [isMoving, setIsMoving] = useState(false);
  // store hooks
  const { getCurrentProjectPageIds, getPageById, getPageAncestorIds, expandPages } = usePageStore(storeType);
  // derived values
  const projectId = page.project_ids?.[0];
  // a page cannot be moved under itself, its own descendants, or an archived page
  const candidateParentIds = (projectId ? getCurrentProjectPageIds(projectId) : []).filter((candidateId) => {
    if (candidateId === page.id) return false;
    const candidate = getPageById(candidateId);
    if (!candidate || candidate.archived_at) return false;
    return !page.id || !getPageAncestorIds(candidateId).includes(page.id);
  });

  const parentOptions: ICustomSearchSelectOption[] = [
    {
      value: null,
      query: "no parent",
      content: (
        <span className="flex items-center gap-2 text-13">
          <PageIcon className="size-3.5 flex-shrink-0 text-tertiary" />
          No parent
        </span>
      ),
    },
    ...candidateParentIds.map((candidateId) => {
      const candidate = getPageById(candidateId);
      return {
        value: candidateId,
        query: getPageName(candidate?.name),
        content: (
          <SwitcherLabel logo_props={candidate?.logo_props} name={getPageName(candidate?.name)} LabelIcon={PageIcon} />
        ),
      };
    }),
  ];

  const selectedParent = selectedParentId ? getPageById(selectedParentId) : undefined;

  const handleClose = () => {
    setSelectedParentId(page.parent ?? null);
    onClose();
  };

  const handleMove = async () => {
    setIsMoving(true);
    try {
      await page.changeParent(selectedParentId);
      if (selectedParentId) expandPages([selectedParentId]);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Success!",
        message: "Page moved successfully.",
      });
      handleClose();
    } catch (_error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "Page could not be moved. Please try again later.",
      });
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.TOP} width={EModalWidth.XL}>
      <div className="space-y-5 p-5">
        <h3 className="text-18 font-medium text-secondary">Move page</h3>
        <p className="text-13 text-tertiary">
          Move <span className="font-medium text-primary">{getPageName(page.name)}</span> under another page, or to the
          top level.
        </p>
        <CustomSearchSelect
          value={selectedParentId}
          onChange={(value: string | null) => setSelectedParentId(value)}
          options={parentOptions}
          label={
            selectedParent ? (
              <SwitcherLabel
                logo_props={selectedParent.logo_props}
                name={getPageName(selectedParent.name)}
                LabelIcon={PageIcon}
              />
            ) : (
              <span className="flex items-center gap-2 text-13">
                <PageIcon className="size-3.5 flex-shrink-0 text-tertiary" />
                No parent
              </span>
            )
          }
          buttonClassName="w-full"
          optionsClassName="w-72"
          input
        />
      </div>
      <div className="flex items-center justify-end gap-2 border-t-[0.5px] border-subtle px-5 py-4">
        <Button variant="secondary" size="lg" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={handleMove}
          loading={isMoving}
          disabled={(selectedParentId ?? null) === (page.parent ?? null)}
        >
          {isMoving ? "Moving" : "Move"}
        </Button>
      </div>
    </ModalCore>
  );
});
