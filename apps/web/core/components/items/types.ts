/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";

/**
 * Data-source-agnostic item-list engine.
 *
 * The engine mirrors the work-items list layout but is driven entirely by
 * props, so any source (git-backed requirements, DB work items, ...) can render
 * through it by supplying a group tree and column descriptors. It never reads a
 * store.
 */

// One right-hand property cell for an item, e.g. a status dropdown or a badge.
export type TItemColumn<T> = {
  key: string;
  render: (item: T) => ReactNode;
  // Fixed width in px for alignment; omit to size to content.
  width?: number;
  // Display-property gate. Defaults to visible.
  visible?: boolean;
};

// A node in the group tree. A node either nests further (children) or holds
// leaf items. Counts are provided by the source (may exceed items.length when
// paginated).
export type TItemGroupNode<T> = {
  key: string;
  label: string;
  count: number;
  icon?: ReactNode;
  // Visual treatment. "group" matches the flat work-item group header; "dir"
  // and "doc" are lighter headers used by the requirements tree.
  kind?: "group" | "dir" | "doc";
  children?: TItemGroupNode<T>[];
  items?: T[];
  // Opaque payload the source uses in quick-add / actions (e.g. file path).
  context?: unknown;
};

// Inline quick-add, shown as a row at the bottom of eligible groups.
export type TItemQuickAdd<T> = {
  // Which groups accept a quick-add row. Defaults to leaf groups with items.
  enabledFor?: (group: TItemGroupNode<T>) => boolean;
  placeholder?: string;
  buttonLabel?: string;
  // Leading hint shown before the input, e.g. a document identifier.
  prefix?: (group: TItemGroupNode<T>) => string | undefined;
  onSubmit: (title: string, group: TItemGroupNode<T>) => Promise<void>;
};

export type TItemListProps<T> = {
  groups: TItemGroupNode<T>[];
  getId: (item: T) => string;
  getName: (item: T) => ReactNode;
  // Leading monospace cell, e.g. an identifier / UID.
  getIdentifier?: (item: T) => ReactNode;
  getHref?: (item: T) => string;
  columns?: TItemColumn<T>[];
  activeId?: string | null;
  onOpen?: (item: T) => void;
  quickAdd?: TItemQuickAdd<T>;
  emptyState?: ReactNode;
};
