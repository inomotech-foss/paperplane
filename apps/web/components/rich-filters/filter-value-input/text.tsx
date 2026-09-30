/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import type { TFilterConditionNodeForDisplay, TFilterProperty } from "@plane/types";
import { cn } from "@plane/utils";
// local imports
import { COMMON_FILTER_ITEM_BORDER_CLASSNAME, EMPTY_FILTER_PLACEHOLDER_TEXT } from "../shared";

type TTextFilterValueInputProps<P extends TFilterProperty> = {
  condition: TFilterConditionNodeForDisplay<P, string>;
  placeholder?: string;
  isDisabled?: boolean;
  onChange: (value: string | null) => void;
};

/**
 * Free text for `contains` conditions. It applies on Enter or when it loses focus, not
 * on every key, so typing does not refetch the list for each letter.
 */
export const TextFilterValueInput = observer(function TextFilterValueInput<P extends TFilterProperty>(
  props: TTextFilterValueInputProps<P>
) {
  const { condition, placeholder, isDisabled, onChange } = props;
  // derived values
  const conditionValue = typeof condition.value === "string" ? condition.value : "";
  // states
  const [draft, setDraft] = useState(conditionValue);

  useEffect(() => {
    setDraft(conditionValue);
  }, [conditionValue]);

  const commit = () => {
    const text = draft.trim();
    if (text === conditionValue) return;
    onChange(text === "" ? null : text);
  };

  return (
    <input
      type="text"
      className={cn("h-full w-36 bg-transparent px-2 text-11 outline-none placeholder:text-placeholder", {
        [COMMON_FILTER_ITEM_BORDER_CLASSNAME]: !isDisabled,
      })}
      value={draft}
      placeholder={placeholder ?? EMPTY_FILTER_PLACEHOLDER_TEXT}
      disabled={isDisabled}
      autoFocus={conditionValue === ""}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
});
