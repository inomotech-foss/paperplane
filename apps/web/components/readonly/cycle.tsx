/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { CyclesOutline } from "@makeplane/propel/icons";
import { cn } from "@plane/utils";
// hooks
import { useProjectCycles } from "@/hooks/queries/use-cycle-queries";
import { useCycle } from "@/hooks/store/use-cycle";

export type TReadonlyCycleProps = {
  className?: string;
  hideIcon?: boolean;
  value: string | null;
  placeholder?: string;
  projectId: string | undefined;
  workspaceSlug: string;
};

export const ReadonlyCycle = observer(function ReadonlyCycle(props: TReadonlyCycleProps) {
  const { className, hideIcon = false, value, placeholder, projectId, workspaceSlug } = props;

  const { t } = useTranslation();
  const { getCycleNameById } = useCycle();
  const cycleName = value ? getCycleNameById(value) : null;
  useProjectCycles(workspaceSlug, value && !cycleName ? projectId : undefined);

  return (
    <div className={cn("flex items-center gap-1 text-13", className)}>
      {!hideIcon && <CyclesOutline className="size-4 flex-shrink-0" />}
      <span className="flex-grow truncate">{cycleName ?? placeholder ?? t("common.none")}</span>
    </div>
  );
});
