/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef } from "react";
import { observer } from "mobx-react";
import type { UseFormSetValue } from "react-hook-form";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import type { IUserTheme } from "@plane/types";
import { getField } from "@/helpers/narrow.helper";

type Props = {
  handleUpdateTheme: (formData: IUserTheme) => Promise<void>;
  setValue: UseFormSetValue<IUserTheme>;
};

export const CustomThemeImportConfigButton = observer(function CustomThemeImportConfigButton(props: Props) {
  const { handleUpdateTheme, setValue } = props;
  // refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  // translation
  const { t } = useTranslation();

  const handleUploadConfig = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const config: unknown = JSON.parse(text);
      const primary = getField(config, "primary");
      const background = getField(config, "background");

      // Validate required fields
      if (!primary || !background) {
        throw new Error("Missing required fields: primary and background");
      }

      // Validate hex color format
      const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      if (typeof primary !== "string" || !hexPattern.test(primary)) {
        throw new Error("Invalid brand color hex format");
      }
      if (typeof background !== "string" || !hexPattern.test(background)) {
        throw new Error("Invalid neutral color hex format");
      }

      // Validate theme mode
      const themeMode = getField(config, "darkPalette") ?? false;
      if (typeof themeMode !== "boolean") {
        throw new Error("Invalid theme mode. Must be a boolean");
      }

      // Apply the configuration to form
      const formData: IUserTheme = {
        theme: "custom",
        primary,
        background,
        darkPalette: themeMode,
      };

      // Update form values
      setValue("primary", formData.primary);
      setValue("background", formData.background);
      setValue("darkPalette", formData.darkPalette);
      setValue("theme", "custom");

      // Apply the theme
      await handleUpdateTheme(formData);

      setToast({
        type: "success",
        title: t("success"),
        message: "Theme configuration imported successfully",
      });
    } catch (error) {
      console.error("Failed to upload config:", error);
      setToast({
        type: "error",
        title: t("error"),
        message: error instanceof Error ? error.message : "Failed to import theme configuration",
      });
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleUploadConfig} className="hidden" />
      <Button
        variant="secondary"
        size="md"
        stretch="auto"
        type="button"
        label="Import config"
        onClick={() => fileInputRef.current?.click()}
      />
    </>
  );
});
