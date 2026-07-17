/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { ChevronRight } from "lucide-react";
// plane imports
import { ControlLink, Row } from "@plane/ui";
import { cn } from "@plane/utils";
// local
import { ItemQuickAdd } from "./item-quick-add";
import type { TItemColumn, TItemGroupNode, TItemListProps } from "./types";

const INDENT_STEP = 16;

const totalCount = <T,>(groups: TItemGroupNode<T>[]): number =>
  groups.reduce((sum, g) => sum + (g.items?.length ?? 0) + (g.children ? totalCount(g.children) : 0), 0);

const isQuickAddEligible = <T,>(group: TItemGroupNode<T>, props: TItemListProps<T>): boolean => {
  if (!props.quickAdd) return false;
  if (props.quickAdd.enabledFor) return props.quickAdd.enabledFor(group);
  return !!group.items?.length;
};

export const ItemList = <T,>(props: TItemListProps<T>) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  if (totalCount(props.groups) === 0) {
    return <div className="mt-16 text-center text-sm text-tertiary">{props.emptyState ?? "Nothing to show."}</div>;
  }

  return (
    <div className="vertical-scrollbar scrollbar-lg relative size-full overflow-auto bg-surface-1">
      {props.groups.map((group) => (
        <ItemGroup key={group.key} group={group} depth={0} collapsed={collapsed} toggle={toggle} listProps={props} />
      ))}
    </div>
  );
};

type GroupProps<T> = {
  group: TItemGroupNode<T>;
  depth: number;
  collapsed: Record<string, boolean>;
  toggle: (key: string) => void;
  listProps: TItemListProps<T>;
};

const ItemGroup = <T,>({ group, depth, collapsed, toggle, listProps }: GroupProps<T>) => {
  const isCollapsed = !!collapsed[group.key];
  const indent = depth * INDENT_STEP;
  const isDoc = group.kind === "doc";

  return (
    <div className="relative flex flex-shrink-0 flex-col">
      <Row
        className={cn(
          "flex w-full flex-shrink-0 items-center gap-1.5 border-b border-subtle bg-layer-1 py-1.5 hover:bg-layer-1-hover",
          !isCollapsed && "sticky top-0 z-[2]"
        )}
        onClick={() => toggle(group.key)}
      >
        <span style={{ width: indent }} className="flex-shrink-0" />
        <button type="button" className="grid size-4 flex-shrink-0 place-items-center text-tertiary">
          <ChevronRight className={cn("size-4 transition-transform", !isCollapsed && "rotate-90")} strokeWidth={2} />
        </button>
        {group.icon && <span className="grid flex-shrink-0 place-items-center">{group.icon}</span>}
        <span
          className={cn(
            "truncate",
            isDoc ? "text-sm font-medium text-primary" : "text-sm font-semibold text-secondary"
          )}
        >
          {group.label}
        </span>
        <span className="pl-1 text-13 font-medium text-tertiary">{group.count}</span>
      </Row>

      {!isCollapsed && (
        <div className="relative">
          {group.children?.map((child) => (
            <ItemGroup
              key={child.key}
              group={child}
              depth={depth + 1}
              collapsed={collapsed}
              toggle={toggle}
              listProps={listProps}
            />
          ))}
          {group.items?.map((item) => (
            <ItemRow key={listProps.getId(item)} item={item} depth={depth + 1} listProps={listProps} />
          ))}
          {isQuickAddEligible(group, listProps) && listProps.quickAdd && (
            <div className="sticky bottom-0 z-[1] w-full flex-shrink-0 border-b border-t border-subtle bg-surface-1">
              <ItemQuickAdd group={group} quickAdd={listProps.quickAdd} indent={(depth + 1) * INDENT_STEP} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

type RowProps<T> = {
  item: T;
  depth: number;
  listProps: TItemListProps<T>;
};

const ItemRow = <T,>({ item, depth, listProps }: RowProps<T>) => {
  const id = listProps.getId(item);
  const active = listProps.activeId === id;
  const href = listProps.getHref?.(item);
  const columns = (listProps.columns ?? []).filter((c) => c.visible !== false);

  const row = (
    <Row
      className={cn(
        "group/list-block relative flex min-h-11 items-center gap-3 border-b border-subtle bg-layer-transparent py-2.5 text-13 transition-colors hover:bg-layer-transparent-hover",
        active && "bg-accent-primary/5 hover:bg-accent-primary/10"
      )}
    >
      <span style={{ width: depth * INDENT_STEP }} className="flex-shrink-0" />
      {listProps.getIdentifier && (
        <span className="w-24 flex-shrink-0 truncate font-mono text-xs text-tertiary">{listProps.getIdentifier(item)}</span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm text-primary">{listProps.getName(item)}</span>
      {columns.map((col) => (
        <ItemCell key={col.key} column={col} item={item} />
      ))}
    </Row>
  );

  if (!href) {
    return (
      <div onClick={() => listProps.onOpen?.(item)} className="w-full cursor-pointer">
        {row}
      </div>
    );
  }
  return (
    <ControlLink href={href} onClick={() => listProps.onOpen?.(item)} className="w-full cursor-pointer">
      {row}
    </ControlLink>
  );
};

const ItemCell = <T,>({ column, item }: { column: TItemColumn<T>; item: T }) => {
  const content = column.render(item);
  if (content === null || content === undefined) return null;
  return (
    <span className="flex-shrink-0" style={column.width ? { width: column.width } : undefined}>
      {content}
    </span>
  );
};
