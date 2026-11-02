/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { StateGroupIcon } from "@plane/blocks/icons";
import { Loader } from "@plane/blocks/skeleton";
import { cn } from "@plane/utils";
// hooks
import { useProjectStates } from "@/hooks/queries/use-state-queries";
import { useProjectState } from "@/hooks/store/use-project-state";

export type TReadonlyStateProps = {
  className?: string;
  iconSize?: string;
  hideIcon?: boolean;
  value: string | undefined | null;
  placeholder?: string;
  projectId: string | undefined;
  workspaceSlug: string;
};

export const ReadonlyState = observer(function ReadonlyState(props: TReadonlyStateProps) {
  const { className, iconSize = "size-4", hideIcon = false, value, placeholder, projectId, workspaceSlug } = props;
  const { t } = useTranslation();
  const { getStateById } = useProjectState();
  const state = getStateById(value);
  const { isLoading } = useProjectStates(workspaceSlug, value && !state ? projectId : undefined);

  if (isLoading) {
    return (
      <Loader className={cn("flex items-center gap-1 text-body-xs-regular", className)}>
        <Loader.Item height="16px" width="16px" className="rounded-full" />
        <Loader.Item height="16px" width="50px" />
      </Loader>
    );
  }

  return (
    <div className={cn("flex items-center gap-1 text-body-xs-regular", className)}>
      {!hideIcon && (
        <StateGroupIcon
          stateGroup={state?.group ?? "backlog"}
          className={cn(iconSize, "flex-shrink-0")}
          color={state?.color}
        />
      )}
      <span className="flex-grow truncate">{state?.name ?? placeholder ?? t("common.none")}</span>
    </div>
  );
});
