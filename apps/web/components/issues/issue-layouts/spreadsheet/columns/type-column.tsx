/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
// types
import type { TIssue } from "@plane/types";
// components
import { WorkItemTypeSelect } from "@/components/issues/work-item-type-select";

type Props = {
  issue: TIssue;
  onClose: () => void;
  onChange: (issue: TIssue, data: Partial<TIssue>, updates: unknown) => void;
  disabled: boolean;
};

export const SpreadsheetTypeColumn = observer(function SpreadsheetTypeColumn(props: Props) {
  const { issue, onChange, disabled, onClose } = props;

  return (
    <div className="h-11 border-b-[0.5px] border-subtle">
      <WorkItemTypeSelect
        workItem={issue}
        onChange={(data) => onChange(issue, { type_id: data }, { changed_property: "type_id", change_details: data })}
        disabled={disabled}
        // `.clickable` is what the table's keyboard navigation clicks on Enter / Space in a focused cell.
        className="clickable"
        variant="table-cell"
        onClose={onClose}
      />
    </div>
  );
});
