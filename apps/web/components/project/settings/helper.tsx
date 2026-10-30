/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRightOutline } from "@makeplane/propel/icons";
import { Badge } from "@makeplane/propel/components/badge";
import { Switch } from "@makeplane/propel/components/switch";
import type { IProject } from "@plane/types";
import { joinUrlPath } from "@plane/utils";

export type TProjectFeatureProperty = keyof Pick<
  IProject,
  "issue_view" | "cycle_view" | "module_view" | "issue_views_view" | "page_view" | "inbox_view"
>;

export type TProjectFeatureItem = {
  key: string;
  property: TProjectFeatureProperty;
  title: string;
  description: string;
  icon: ReactNode;
  isPro: boolean;
  isEnabled: boolean;
  href?: string;
};

type Props = {
  workspaceSlug: string;
  projectId: string;
  featureItem: TProjectFeatureItem;
  value: boolean;
  handleSubmit: (featureKey: string, featureProperty: TProjectFeatureProperty) => void;
  disabled?: boolean;
};

export function ProjectFeatureToggle(props: Props) {
  const { workspaceSlug, projectId, featureItem, value, handleSubmit, disabled } = props;
  return featureItem.href ? (
    <Link href={joinUrlPath(workspaceSlug, "settings", "projects", projectId, "features", featureItem.href)}>
      <div className="flex items-center gap-2">
        <Badge variant={value ? "brand" : "neutral"} size="xs" label={value ? "Enabled" : "Disabled"} />
        <ChevronRightOutline className="h-4 w-4 text-tertiary" />
      </div>
    </Link>
  ) : (
    <Switch
      size="sm"
      checked={value}
      onCheckedChange={() => handleSubmit(featureItem.key, featureItem.property)}
      disabled={disabled}
      aria-label="Toggle project feature"
    />
  );
}
