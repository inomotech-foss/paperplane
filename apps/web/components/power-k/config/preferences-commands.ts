/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback } from "react";
import { useTheme } from "next-themes";
import { Languages } from "lucide-react";
import { CalendarOutline, GlobeOutline, PaletteOutline } from "@makeplane/propel/icons";
// plane imports
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import type { TUserProfile } from "@plane/types";
import { EStartOfTheWeek, isOneOf } from "@plane/types";
// components
import type { TPowerKCommandConfig } from "@/components/power-k/core/types";
// hooks
import { useUser, useUserProfile } from "@/hooks/store/user";
import { isUserTimezone } from "@/lib/timezone";

/**
 * Preferences commands - Preferences related commands
 */
const START_OF_THE_WEEK_VALUES = [
  EStartOfTheWeek.SUNDAY,
  EStartOfTheWeek.MONDAY,
  EStartOfTheWeek.TUESDAY,
  EStartOfTheWeek.WEDNESDAY,
  EStartOfTheWeek.THURSDAY,
  EStartOfTheWeek.FRIDAY,
  EStartOfTheWeek.SATURDAY,
];

export const usePowerKPreferencesCommands = (): TPowerKCommandConfig[] => {
  // store hooks
  const { setTheme } = useTheme();
  const { updateCurrentUser } = useUser();
  const { updateUserProfile, updateUserTheme } = useUserProfile();
  // translation
  const { t } = useTranslation();

  const handleUpdateTheme = useCallback(
    async (newTheme: string) => {
      setTheme(newTheme);
      return updateUserTheme({ theme: newTheme })
        .then(() => {
          setToast({
            type: "success",
            title: "Theme updated",
            message: "Reloading to apply changes...",
          });
          // reload the page after showing the toast
          window.location.reload();
          return;
        })
        .catch(() => {
          setToast({
            type: "error",
            title: t("toast.error"),
            message: t("power_k.preferences_actions.toast.theme.error"),
          });
          return;
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setTheme, updateUserTheme]
  );

  const handleUpdateTimezone = useCallback(
    (value: string) => {
      (isUserTimezone(value)
        ? updateCurrentUser({ user_timezone: value })
        : Promise.reject(new Error(`Unknown timezone ${value}`))
      )
        .then(() => {
          setToast({
            type: "success",
            title: t("toast.success"),
            message: t("power_k.preferences_actions.toast.timezone.success"),
          });
          return;
        })
        .catch(() => {
          setToast({
            type: "error",
            title: t("toast.error"),
            message: t("power_k.preferences_actions.toast.timezone.error"),
          });
          return;
        });
    },
    [t, updateCurrentUser]
  );

  const handleUpdateUserProfile = useCallback(
    (payload: Partial<TUserProfile>) => {
      updateUserProfile(payload)
        .then(() => {
          setToast({
            type: "success",
            title: t("toast.success"),
            message: t("power_k.preferences_actions.toast.generic.success"),
          });
          return;
        })
        .catch(() => {
          setToast({
            type: "error",
            title: t("toast.error"),
            message: t("power_k.preferences_actions.toast.generic.error"),
          });
          return;
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateUserProfile]
  );

  return [
    {
      id: "update_interface_theme",
      group: "preferences",
      type: "change-page",
      changesState: false,
      page: "update-theme",
      i18n_title: "power_k.preferences_actions.update_theme",
      icon: PaletteOutline,
      onSelect: (data) => {
        if (typeof data !== "string") return;
        const theme = data;
        void handleUpdateTheme(theme);
      },
      isEnabled: () => true,
      isVisible: () => true,
      closeOnSelect: true,
    },
    {
      id: "update_timezone",
      group: "preferences",
      page: "update-timezone",
      type: "change-page",
      changesState: false,
      i18n_title: "power_k.preferences_actions.update_timezone",
      icon: GlobeOutline,
      onSelect: (data) => {
        if (typeof data !== "string") return;
        const timezone = data;
        handleUpdateTimezone(timezone);
      },
      isEnabled: () => true,
      isVisible: () => true,
      closeOnSelect: true,
    },
    {
      id: "update_start_of_week",
      group: "preferences",
      page: "update-start-of-week",
      type: "change-page",
      changesState: false,
      i18n_title: "power_k.preferences_actions.update_start_of_week",
      icon: CalendarOutline,
      onSelect: (data) => {
        if (!isOneOf(START_OF_THE_WEEK_VALUES, data)) return;
        const startOfWeek = data;
        handleUpdateUserProfile({ start_of_the_week: startOfWeek });
      },
      isEnabled: () => true,
      isVisible: () => true,
      closeOnSelect: true,
    },
    {
      id: "update_interface_language",
      group: "preferences",
      page: "update-language",
      type: "change-page",
      changesState: false,
      i18n_title: "power_k.preferences_actions.update_language",
      icon: Languages,
      onSelect: (data) => {
        if (typeof data !== "string") return;
        const language = data;
        handleUpdateUserProfile({ language });
      },
      isEnabled: () => true,
      isVisible: () => true,
      closeOnSelect: true,
    },
  ];
};
