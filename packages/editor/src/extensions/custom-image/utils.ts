/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Editor } from "@tiptap/core";
import type { Attrs } from "@tiptap/pm/model";
import { AlignCenterOutline, AlignLeftOutline, AlignRightOutline } from "@makeplane/propel/icons";
import type { ComponentType, SVGProps } from "react";
// helpers
import { isOneOf, readNumber, readString } from "@/helpers/narrow";
// local imports
import { ECustomImageAttributeNames, ECustomImageStatus } from "./types";
import type { TCustomImageAlignment, Pixel, PixelAttribute, TCustomImageAttributes } from "./types";

export const DEFAULT_CUSTOM_IMAGE_ATTRIBUTES: TCustomImageAttributes = {
  [ECustomImageAttributeNames.SOURCE]: null,
  [ECustomImageAttributeNames.ID]: null,
  [ECustomImageAttributeNames.WIDTH]: "35%",
  [ECustomImageAttributeNames.HEIGHT]: "auto",
  [ECustomImageAttributeNames.ASPECT_RATIO]: null,
  [ECustomImageAttributeNames.ALIGNMENT]: "left",
  [ECustomImageAttributeNames.STATUS]: ECustomImageStatus.PENDING,
};

const IMAGE_ALIGNMENTS: readonly TCustomImageAlignment[] = ["left", "center", "right"];
const IMAGE_STATUSES: readonly ECustomImageStatus[] = Object.values(ECustomImageStatus);

const isPixel = (value: string): value is Pixel =>
  value.endsWith("px") && value.length > 2 && Number.isFinite(Number(value.slice(0, -2)));

const readPixelAttribute = <TKeyword extends string>(
  value: unknown,
  keyword: TKeyword
): PixelAttribute<TKeyword | number> | null => {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  if (isOneOf([keyword], value)) return value;
  return isPixel(value) ? value : null;
};

export const getCustomImageAttributes = (attrs: Attrs): TCustomImageAttributes => {
  const alignment: unknown = attrs[ECustomImageAttributeNames.ALIGNMENT];
  const status: unknown = attrs[ECustomImageAttributeNames.STATUS];
  return {
    [ECustomImageAttributeNames.ID]: readString(attrs, ECustomImageAttributeNames.ID) ?? null,
    [ECustomImageAttributeNames.WIDTH]: readPixelAttribute(attrs[ECustomImageAttributeNames.WIDTH], "35%"),
    [ECustomImageAttributeNames.HEIGHT]: readPixelAttribute(attrs[ECustomImageAttributeNames.HEIGHT], "auto"),
    [ECustomImageAttributeNames.ASPECT_RATIO]: readNumber(attrs, ECustomImageAttributeNames.ASPECT_RATIO) ?? null,
    [ECustomImageAttributeNames.SOURCE]: readString(attrs, ECustomImageAttributeNames.SOURCE) ?? null,
    [ECustomImageAttributeNames.ALIGNMENT]: isOneOf(IMAGE_ALIGNMENTS, alignment)
      ? alignment
      : DEFAULT_CUSTOM_IMAGE_ATTRIBUTES[ECustomImageAttributeNames.ALIGNMENT],
    [ECustomImageAttributeNames.STATUS]: isOneOf(IMAGE_STATUSES, status)
      ? status
      : DEFAULT_CUSTOM_IMAGE_ATTRIBUTES[ECustomImageAttributeNames.STATUS],
  };
};

export const getImageComponentImageFileMap = (editor: Editor) => editor.storage.imageComponent?.fileMap;

export const ensurePixelString = <TDefault>(
  value: Pixel | TDefault | number | undefined | null,
  defaultValue?: TDefault
) => {
  if (!value || value === defaultValue) {
    return defaultValue;
  }

  if (typeof value === "number") {
    return `${value}px` satisfies Pixel;
  }

  return value;
};

export const IMAGE_ALIGNMENT_OPTIONS: {
  label: string;
  value: TCustomImageAlignment;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  {
    label: "Left",
    value: "left",
    icon: AlignLeftOutline,
  },
  {
    label: "Center",
    value: "center",
    icon: AlignCenterOutline,
  },
  {
    label: "Right",
    value: "right",
    icon: AlignRightOutline,
  },
];
export const getImageBlockId = (id: string) => `editor-image-block-${id}`;

export const isImageDuplicating = (status: ECustomImageStatus) => status === ECustomImageStatus.DUPLICATING;

export const isImageDuplicationComplete = (status: ECustomImageStatus) =>
  status === ECustomImageStatus.UPLOADED || status === ECustomImageStatus.DUPLICATION_FAILED;

export const hasImageDuplicationFailed = (status: ECustomImageStatus) =>
  status === ECustomImageStatus.DUPLICATION_FAILED;
