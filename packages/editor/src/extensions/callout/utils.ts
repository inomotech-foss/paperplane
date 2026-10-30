/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Attrs } from "@tiptap/pm/model";
// plane imports
import type { TLogoProps } from "@plane/types";
import { sanitizeHTML } from "@plane/utils";
// helpers
import { isOneOf, readProperty, readString } from "@/helpers/narrow";
// types
import type { TCalloutBlockAttributes, TCalloutBlockEmojiAttributes, TCalloutBlockIconAttributes } from "./types";
import { ECalloutAttributeNames } from "./types";

export const DEFAULT_CALLOUT_BLOCK_ATTRIBUTES: TCalloutBlockAttributes = {
  [ECalloutAttributeNames.ID]: null,
  [ECalloutAttributeNames.LOGO_IN_USE]: "emoji",
  [ECalloutAttributeNames.ICON_COLOR]: undefined,
  [ECalloutAttributeNames.ICON_NAME]: undefined,
  [ECalloutAttributeNames.EMOJI_UNICODE]: "128161",
  [ECalloutAttributeNames.EMOJI_URL]: "https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4a1.png",
  [ECalloutAttributeNames.BACKGROUND]: undefined,
  [ECalloutAttributeNames.BLOCK_TYPE]: "callout-component",
};

const LOGO_TYPES: readonly TCalloutBlockAttributes[ECalloutAttributeNames.LOGO_IN_USE][] = ["emoji", "icon"];

export const getCalloutBlockAttributes = (attrs: Attrs): TCalloutBlockAttributes => {
  const logoInUse: unknown = attrs[ECalloutAttributeNames.LOGO_IN_USE];
  return {
    [ECalloutAttributeNames.ID]: readString(attrs, ECalloutAttributeNames.ID) ?? null,
    [ECalloutAttributeNames.LOGO_IN_USE]: isOneOf(LOGO_TYPES, logoInUse)
      ? logoInUse
      : DEFAULT_CALLOUT_BLOCK_ATTRIBUTES[ECalloutAttributeNames.LOGO_IN_USE],
    [ECalloutAttributeNames.ICON_COLOR]: readString(attrs, ECalloutAttributeNames.ICON_COLOR),
    [ECalloutAttributeNames.ICON_NAME]: readString(attrs, ECalloutAttributeNames.ICON_NAME),
    [ECalloutAttributeNames.EMOJI_UNICODE]: readString(attrs, ECalloutAttributeNames.EMOJI_UNICODE),
    [ECalloutAttributeNames.EMOJI_URL]: readString(attrs, ECalloutAttributeNames.EMOJI_URL),
    [ECalloutAttributeNames.BACKGROUND]: readString(attrs, ECalloutAttributeNames.BACKGROUND),
    [ECalloutAttributeNames.BLOCK_TYPE]: "callout-component",
  };
};

type TStoredLogoValue = Pick<TCalloutBlockAttributes, ECalloutAttributeNames.LOGO_IN_USE> &
  (TCalloutBlockEmojiAttributes | TCalloutBlockIconAttributes);

// function to get the stored logo from local storage
export const getStoredLogo = (): TStoredLogoValue => {
  const fallBackValues: TStoredLogoValue = {
    [ECalloutAttributeNames.LOGO_IN_USE]: "emoji",
    [ECalloutAttributeNames.EMOJI_UNICODE]: DEFAULT_CALLOUT_BLOCK_ATTRIBUTES[ECalloutAttributeNames.EMOJI_UNICODE],
    [ECalloutAttributeNames.EMOJI_URL]: DEFAULT_CALLOUT_BLOCK_ATTRIBUTES[ECalloutAttributeNames.EMOJI_URL],
  };

  if (typeof window !== "undefined") {
    const storedData = sanitizeHTML(localStorage.getItem("editor-calloutComponent-logo") ?? "");
    if (storedData) {
      let parsedData: unknown;
      try {
        parsedData = JSON.parse(storedData);
      } catch (error) {
        console.error(`Error parsing stored callout logo, stored value- ${storedData}`, error);
        localStorage.removeItem("editor-calloutComponent-logo");
        return fallBackValues;
      }
      const inUse = readString(parsedData, "in_use");
      const emoji = readProperty(parsedData, "emoji");
      const emojiValue = readString(emoji, "value");
      if (inUse === "emoji" && emojiValue) {
        return {
          [ECalloutAttributeNames.LOGO_IN_USE]: "emoji",
          [ECalloutAttributeNames.EMOJI_UNICODE]: emojiValue,
          [ECalloutAttributeNames.EMOJI_URL]:
            readString(emoji, "url") || DEFAULT_CALLOUT_BLOCK_ATTRIBUTES[ECalloutAttributeNames.EMOJI_URL],
        };
      }
      const icon = readProperty(parsedData, "icon");
      const iconName = readString(icon, "name");
      if (inUse === "icon" && iconName) {
        return {
          [ECalloutAttributeNames.LOGO_IN_USE]: "icon",
          [ECalloutAttributeNames.ICON_NAME]: iconName,
          [ECalloutAttributeNames.ICON_COLOR]:
            readString(icon, "color") || DEFAULT_CALLOUT_BLOCK_ATTRIBUTES[ECalloutAttributeNames.ICON_COLOR],
        };
      }
    }
  }
  // fallback values
  return fallBackValues;
};
// function to update the stored logo on local storage
export const updateStoredLogo = (value: TLogoProps): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem("editor-calloutComponent-logo", JSON.stringify(value));
};
// function to get the stored background color from local storage
export const getStoredBackgroundColor = (): string | null => {
  if (typeof window !== "undefined") {
    return sanitizeHTML(localStorage.getItem("editor-calloutComponent-background") ?? "");
  }
  return null;
};
// function to update the stored background color on local storage
export const updateStoredBackgroundColor = (value: string | null): void => {
  if (typeof window === "undefined") return;
  if (value === null) {
    localStorage.removeItem("editor-calloutComponent-background");
    return;
  } else {
    localStorage.setItem("editor-calloutComponent-background", value);
  }
};
