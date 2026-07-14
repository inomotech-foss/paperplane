/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
// helpers
import { cn } from "../utils/classname";

type SkeletonProps = {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
};

function SkeletonRoot({ children, className = "", ariaLabel = "Loading content" }: SkeletonProps) {
  return (
    <output data-slot="skeleton" className={cn("block animate-pulse", className)} aria-label={ariaLabel}>
      {children}
    </output>
  );
}

type ItemProps = {
  height?: string;
  width?: string;
  className?: string;
};

function SkeletonItem({ height = "auto", width = "auto", className = "" }: ItemProps) {
  return <div data-slot="skeleton-item" className={cn("rounded-md bg-layer-1", className)} style={{ height, width }} />;
}

const Skeleton = Object.assign(SkeletonRoot, { Item: SkeletonItem });

SkeletonRoot.displayName = "plane-ui-skeleton";
SkeletonItem.displayName = "plane-ui-skeleton-item";

export { Skeleton, SkeletonRoot, SkeletonItem };
