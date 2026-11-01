/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import type { TLinkEditableFields } from "@plane/types";
import { useHome } from "@/hooks/store/use-home";
import { getApiErrorMessage } from "@/helpers/error.helper";
import { readField } from "@plane/types";

export type TLinkOperations = {
  create: (data: TLinkEditableFields) => Promise<void>;
  update: (linkId: string, data: TLinkEditableFields) => Promise<void>;
  remove: (linkId: string) => Promise<void>;
};
export type TProjectLinkRoot = {
  workspaceSlug: string;
};

export const useLinks = (workspaceSlug: string) => {
  // hooks
  const {
    quickLinks: {
      createLink,
      updateLink,
      removeLink,
      isLinkModalOpen,
      toggleLinkModal,
      linkData,
      setLinkData,
      fetchLinks,
    },
  } = useHome();
  const { t } = useTranslation();

  const linkOperations: TLinkOperations = useMemo(
    () => ({
      create: async (data: TLinkEditableFields) => {
        try {
          if (!workspaceSlug) throw new Error("Missing required fields");
          await createLink(workspaceSlug, data);
          setToast({
            message: t("links.toasts.created.message"),
            type: "success",
            title: t("links.toasts.created.title"),
          });
          toggleLinkModal(false);
        } catch (error: unknown) {
          console.error("error", getApiErrorMessage(readField(error, "data")));
          setToast({
            message: getApiErrorMessage(readField(error, "data")) ?? t("links.toasts.not_created.message"),
            type: "error",
            title: t("links.toasts.not_created.title"),
          });
          throw error;
        }
      },
      update: async (linkId: string, data: TLinkEditableFields) => {
        try {
          if (!workspaceSlug) throw new Error("Missing required fields");
          await updateLink(workspaceSlug, linkId, data);
          setToast({
            message: t("links.toasts.updated.message"),
            type: "success",
            title: t("links.toasts.updated.title"),
          });
          toggleLinkModal(false);
        } catch (error: unknown) {
          setToast({
            message: getApiErrorMessage(readField(error, "data")) ?? t("links.toasts.not_updated.message"),
            type: "error",
            title: t("links.toasts.not_updated.title"),
          });
          throw error;
        }
      },
      remove: async (linkId: string) => {
        try {
          if (!workspaceSlug) throw new Error("Missing required fields");
          await removeLink(workspaceSlug, linkId);
          setToast({
            message: t("links.toasts.removed.message"),
            type: "success",
            title: t("links.toasts.removed.message"),
          });
        } catch (error: unknown) {
          setToast({
            message: getApiErrorMessage(readField(error, "data")) ?? t("links.toasts.not_removed.message"),
            type: "error",
            title: t("links.toasts.not_removed.title"),
          });
        }
      },
    }),
    [workspaceSlug]
  );

  const handleOnClose = () => {
    toggleLinkModal(false);
  };

  return { linkOperations, handleOnClose, isLinkModalOpen, toggleLinkModal, linkData, setLinkData, fetchLinks };
};
