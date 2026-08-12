/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { observer } from "mobx-react";
import { GraduationCap, HelpCircle } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { PageIcon } from "@plane/propel/icons";
// ui
import { CustomMenu } from "@plane/ui";
// compat
import { useParams, useRouter } from "next/navigation";
// components
import { ProductUpdatesModal } from "@/components/global";
import { AppSidebarItem } from "@/components/sidebar/sidebar-item";
import { PlaneVersionNumber } from "@/components/global/version-number";
// hooks
import { usePowerK } from "@/hooks/store/use-power-k";
import { useUserTrainings } from "@/hooks/store/user";

export const HelpMenuRoot = observer(function HelpMenuRoot() {
  // router
  const router = useRouter();
  const { workspaceSlug } = useParams();
  // store hooks
  const { t } = useTranslation();
  const { toggleShortcutsListModal } = usePowerK();
  const { unseenCount } = useUserTrainings();
  // states
  const [isNeedHelpOpen, setIsNeedHelpOpen] = useState(false);
  const [isProductUpdatesModalOpen, setProductUpdatesModalOpen] = useState(false);

  return (
    <>
      <ProductUpdatesModal isOpen={isProductUpdatesModalOpen} handleClose={() => setProductUpdatesModalOpen(false)} />

      <CustomMenu
        customButton={
          <div className="relative">
            <AppSidebarItem
              variant="button"
              item={{
                icon: <HelpCircle className="size-5" />,
                isActive: isNeedHelpOpen,
              }}
            />
            {unseenCount > 0 && (
              <span className="pointer-events-none absolute -top-0.5 -right-0.5 size-2 rounded-full bg-accent-primary" />
            )}
          </div>
        }
        // customButtonClassName="relative grid place-items-center rounded-md p-1.5 outline-none"
        menuButtonOnClick={() => !isNeedHelpOpen && setIsNeedHelpOpen(true)}
        onMenuClose={() => setIsNeedHelpOpen(false)}
        placement="bottom-end"
        maxHeight="lg"
        closeOnSelect
      >
        <CustomMenu.MenuItem onClick={() => window.open("https://go.plane.so/p-docs", "_blank")}>
          <div className="flex items-center gap-x-2 rounded-sm text-11">
            <PageIcon className="h-3.5 w-3.5 text-secondary" height={14} width={14} />
            <span className="text-11">{t("documentation")}</span>
          </div>
        </CustomMenu.MenuItem>
        {workspaceSlug && (
          <CustomMenu.MenuItem onClick={() => router.push(`/${workspaceSlug.toString()}/trainings`)}>
            <div className="flex w-full items-center justify-between gap-x-2 rounded-sm text-11">
              <div className="flex items-center gap-x-2">
                <GraduationCap className="h-3.5 w-3.5 text-secondary" />
                <span className="text-11">{t("trainings.title")}</span>
              </div>
              {unseenCount > 0 && (
                <span className="rounded-full bg-accent-primary px-1.5 py-0.5 text-10 font-medium text-on-color">
                  {unseenCount}
                </span>
              )}
            </div>
          </CustomMenu.MenuItem>
        )}
        <div className="my-1 border-t border-subtle" />
        <CustomMenu.MenuItem>
          <button
            type="button"
            onClick={() => toggleShortcutsListModal(true)}
            className="justify-sbg-layer-211 flex w-full items-center hover:bg-layer-1"
          >
            <span className="text-11">{t("keyboard_shortcuts")}</span>
          </button>
        </CustomMenu.MenuItem>
        <CustomMenu.MenuItem>
          <button
            type="button"
            onClick={() => setProductUpdatesModalOpen(true)}
            className="justify-sbg-layer-211 flex w-full items-center hover:bg-layer-1"
          >
            <span className="text-11">{t("whats_new")}</span>
          </button>
        </CustomMenu.MenuItem>
        <CustomMenu.MenuItem onClick={() => window.open("https://forum.plane.so", "_blank", "noopener,noreferrer")}>
          <div className="flex items-center gap-x-2 rounded-sm text-11">
            <span className="text-11">Forum</span>
          </div>
        </CustomMenu.MenuItem>
        <div className="mt-1 border-t border-subtle px-1 pt-2 text-11 text-secondary">
          <PlaneVersionNumber />
        </div>
      </CustomMenu>
    </>
  );
});
