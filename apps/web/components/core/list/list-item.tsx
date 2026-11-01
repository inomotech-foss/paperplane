/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type React from "react";
import Link from "next/link";
// ui
import { Tooltip } from "@makeplane/propel/components/tooltip";
import {
  ClickableCard,
  ClickableCardLink,
  ClickableCardRaised,
  clickableCardRaisedClassName,
} from "@plane/blocks/clickable-card";
import { Row } from "@plane/blocks/layout";
// helpers
import { cn } from "@plane/utils";

interface IListItemProps {
  id?: string;
  title: string;
  itemLink: string;
  onItemClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  prependTitleElement?: React.ReactNode;
  appendTitleElement?: React.ReactNode;
  actionableItems?: React.ReactNode;
  isMobile?: boolean;
  parentRef: React.RefObject<HTMLDivElement | null>;
  disableLink?: boolean;
  className?: string;
  itemClassName?: string;
  actionItemContainerClassName?: string;
  isSidebarOpen?: boolean;
  quickActionElement?: React.ReactNode;
  preventDefaultProgress?: boolean;
  leftElementClassName?: string;
  rightElementClassName?: string;
}

export function ListItem(props: IListItemProps) {
  const {
    id,
    title,
    prependTitleElement,
    appendTitleElement,
    actionableItems,
    itemLink,
    onItemClick,
    isMobile = false,
    parentRef,
    disableLink = false,
    className = "",
    actionItemContainerClassName = "",
    isSidebarOpen = false,
    quickActionElement,
    itemClassName = "",
    preventDefaultProgress = false,
    leftElementClassName = "",
    rightElementClassName = "",
  } = props;

  return (
    <div ref={parentRef} className="relative">
      <Row
        className={cn(
          "group flex min-h-[52px] w-full flex-col items-center justify-between gap-3 border-b border-subtle bg-layer-transparent py-4 text-13 hover:bg-layer-transparent-hover",
          { "xl:flex-row xl:gap-5 xl:py-0": isSidebarOpen, "lg:flex-row lg:gap-5 lg:py-0": !isSidebarOpen },
          className
        )}
      >
        <div className={cn("relative flex w-full items-center justify-between gap-3 truncate", itemClassName)}>
          <ClickableCard className="flex w-full items-center gap-3 overflow-hidden">
            <div className={cn("flex items-center gap-4 truncate", leftElementClassName)}>
              {prependTitleElement && (
                <ClickableCardRaised render={<span />} className="flex flex-shrink-0 items-center">
                  {prependTitleElement}
                </ClickableCardRaised>
              )}
              <ClickableCardLink
                id={id}
                className="truncate"
                href={itemLink}
                render={(linkProps) => <Link {...linkProps} />}
                onClick={onItemClick}
                disabled={disableLink}
                data-prevent-progress={preventDefaultProgress}
              >
                <Tooltip label={title} layout="stacked" disabled={isMobile}>
                  <span className={cn(clickableCardRaisedClassName, "truncate text-13")}>{title}</span>
                </Tooltip>
              </ClickableCardLink>
            </div>
            {appendTitleElement && (
              <ClickableCardRaised
                render={<span />}
                className={cn("flex flex-shrink-0 items-center", rightElementClassName)}
              >
                {appendTitleElement}
              </ClickableCardRaised>
            )}
          </ClickableCard>
          {quickActionElement}
        </div>
        {actionableItems && (
          <div
            className={cn(
              "relative flex w-full flex-shrink-0 flex-wrap items-center justify-start gap-4",
              {
                "xl:w-auto xl:flex-shrink-0 xl:flex-nowrap": isSidebarOpen,
                "lg:w-auto lg:flex-shrink-0 lg:flex-nowrap": !isSidebarOpen,
              },
              actionItemContainerClassName
            )}
          >
            {actionableItems}
          </div>
        )}
      </Row>
    </div>
  );
}
