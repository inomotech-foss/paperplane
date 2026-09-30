/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import { observer } from "mobx-react";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxSearch,
  ComboboxTrigger,
  useFilter,
} from "@makeplane/propel/components/combobox";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { PagesOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import { getPageName } from "@plane/utils";
// components
import { SwitcherIcon } from "@/components/common/switcher-label";
// hooks
import type { EPageStoreType } from "@/hooks/store";
import { usePageStore } from "@/hooks/store";
// store
import type { TPageInstance } from "@/store/pages/base-page";

type TParentOption = {
  value: string | null;
  label: string;
  icon: ReactNode;
};

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
  // plane hooks
  const { t } = useTranslation();
  const { contains } = useFilter();
  // store hooks
  const { getCurrentProjectPageIds, getPageById, getChildPageIds, expandPages } = usePageStore(storeType);
  // derived values
  const projectId = page.project_ids?.[0];
  // the page itself and all of its descendants cannot become its parent
  const invalidParentIds = new Set<string>();
  if (page.id) {
    const idsToVisit = [page.id];
    while (idsToVisit.length > 0) {
      const currentId = idsToVisit.pop() as string;
      if (invalidParentIds.has(currentId)) continue;
      invalidParentIds.add(currentId);
      idsToVisit.push(...getChildPageIds(currentId));
    }
  }
  // a page cannot be moved under itself, its own descendants, or an archived page
  const candidateParentIds = (projectId ? getCurrentProjectPageIds(projectId) : []).filter((candidateId) => {
    if (invalidParentIds.has(candidateId)) return false;
    const candidate = getPageById(candidateId);
    return !!candidate && !candidate.archived_at;
  });

  const parentOptions: TParentOption[] = [
    {
      value: null,
      label: "No parent",
      icon: <PagesOutline className="size-3.5 flex-shrink-0 text-tertiary" />,
    },
    ...candidateParentIds.map((candidateId) => {
      const candidate = getPageById(candidateId);
      return {
        value: candidateId,
        label: getPageName(candidate?.name),
        icon: <SwitcherIcon logo_props={candidate?.logo_props} LabelIcon={PagesOutline} size={14} />,
      };
    }),
  ];

  const selectedOption = parentOptions.find((option) => option.value === selectedParentId) ?? parentOptions[0];

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
        type: "success",
        title: "Success!",
        message: "Page moved successfully.",
      });
      handleClose();
    } catch (_error) {
      setToast({
        type: "error",
        title: "Error!",
        message: "Page could not be moved. Please try again later.",
      });
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent size="md">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>Move page</DialogTitle>
              <DialogDescription>
                Move <span className="font-medium text-primary">{getPageName(page.name)}</span> under another page, or
                to the top level.
              </DialogDescription>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <Combobox<TParentOption, false>
              items={parentOptions}
              value={selectedOption}
              onValueChange={(nextValue) => {
                if (nextValue) setSelectedParentId(nextValue.value);
              }}
              itemToStringLabel={(option) => option.label}
              itemToStringValue={(option) => option.value ?? ""}
              isItemEqualToValue={(option, selected) => option.value === selected.value}
              filter={(option, query) => contains(option.label, query)}
            >
              <ComboboxTrigger size="lg" icon={selectedOption.icon} />
              <ComboboxContent
                aria-label="Parent page"
                sizing="anchor"
                search={<ComboboxSearch placeholder={t("common.search.label")} aria-label={t("common.search.label")} />}
              >
                <ComboboxEmpty>{t("common.search.no_matches_found")}</ComboboxEmpty>
                <ComboboxList aria-label="Parent page">
                  {(option: TParentOption) => (
                    <ComboboxItem key={option.value ?? "none"} value={option} label={option.label} icon={option.icon} />
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </DialogBody>
        </DialogMain>
        <DialogActions>
          <Button variant="secondary" size="md" stretch="auto" label="Cancel" onClick={handleClose} />
          <Button
            variant="primary"
            size="md"
            stretch="auto"
            label={isMoving ? "Moving" : "Move"}
            onClick={() => void handleMove()}
            loading={isMoving}
            disabled={(selectedParentId ?? null) === (page.parent ?? null)}
          />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
});
