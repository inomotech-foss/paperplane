/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useEffect, useState, useCallback } from "react";
import type { EditorRefApi } from "@plane/editor";
// plane imports
import { Icon } from "@makeplane/propel/components/icon";
import { Menu, MenuContent, MenuItem } from "@makeplane/propel/components/menu";
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarMenuTrigger,
  ToolbarSeparator,
  ToolbarToggle,
} from "@makeplane/propel/components/toolbar";
import { Tooltip, TooltipProvider } from "@makeplane/propel/components/tooltip";
// constants
import type { ToolbarMenuItem } from "@plane/editor";
import { TOOLBAR_ITEMS, TYPOGRAPHY_ITEMS } from "@plane/editor";
// local imports
import { ColorDropdown } from "./color-dropdown";

type Props = {
  editorRef: EditorRefApi;
};

type ToolbarItemProps = {
  item: ToolbarMenuItem;
  isActive: boolean;
  // insert actions (table, image, attachment) are plain buttons, not pressed-state toggles
  isInsertAction: boolean;
  executeCommand: EditorRefApi["executeToolbarItem"];
};

const ToolbarItem = React.memo(function ToolbarItem(props: ToolbarItemProps) {
  const { item, isActive, isInsertAction, executeCommand } = props;

  const handleClick = () => executeCommand(item);
  const icon = <Icon icon={item.icon} />;

  return (
    <Tooltip label={item.name} shortcut={item.shortcut?.join(" + ")}>
      {isInsertAction ? (
        <ToolbarButton aria-label={item.name} icon={icon} onClick={handleClick} />
      ) : (
        <ToolbarToggle aria-label={item.name} icon={icon} pressed={!!isActive} onPressedChange={handleClick} />
      )}
    </Tooltip>
  );
});

ToolbarItem.displayName = "ToolbarItem";

const toolbarItems = TOOLBAR_ITEMS.document;

export function PageToolbar(props: Props) {
  const { editorRef } = props;
  // states
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>(() => {
    const initialStates: Record<string, boolean> = {};
    Object.values(toolbarItems)
      .flat()
      .forEach((item) => {
        initialStates[item.renderKey] = editorRef.isToolbarItemActive(item);
      });
    return initialStates;
  });

  const updateActiveStates = useCallback(() => {
    const newActiveStates: Record<string, boolean> = {};
    Object.values(toolbarItems)
      .flat()
      .forEach((item) => {
        newActiveStates[item.renderKey] = editorRef.isToolbarItemActive(item);
      });
    setActiveStates(newActiveStates);
  }, [editorRef]);

  useEffect(() => {
    const unsubscribe = editorRef.onStateChange(updateActiveStates);
    return () => unsubscribe();
  }, [editorRef, updateActiveStates]);

  const activeTypography = TYPOGRAPHY_ITEMS.find((item) => editorRef.isToolbarItemActive(item));

  return (
    <TooltipProvider>
      <div className="animate-in fade-in flex items-center overflow-x-auto duration-200">
        <Toolbar size="md" elevation="flat" aria-label="Formatting toolbar">
          <Menu>
            <ToolbarMenuTrigger label={activeTypography?.name || "Text"} />
            <MenuContent side="bottom" align="start">
              {TYPOGRAPHY_ITEMS.map((item) => (
                <MenuItem
                  key={item.renderKey}
                  label={item.name}
                  icon={<Icon icon={item.icon} />}
                  selected={activeTypography?.itemKey === item.itemKey}
                  onClick={() => {
                    if (activeTypography?.itemKey !== item.itemKey) {
                      editorRef.executeToolbarItem(item);
                    }
                  }}
                />
              ))}
            </MenuContent>
          </Menu>
          <ToolbarSeparator />
          <ColorDropdown
            handleColorSelect={(key, color) =>
              editorRef.executeMenuItemCommand({
                itemKey: key,
                color,
              })
            }
            isColorActive={(key, color) =>
              editorRef.isMenuItemActive({
                itemKey: key,
                color,
              })
            }
          />
          {Object.keys(toolbarItems).map((key) => (
            <React.Fragment key={key}>
              <ToolbarSeparator />
              <ToolbarGroup>
                {toolbarItems[key].map((item) => (
                  <ToolbarItem
                    key={item.renderKey}
                    item={item}
                    isActive={activeStates[item.renderKey]}
                    isInsertAction={key === "complex"}
                    executeCommand={editorRef.executeToolbarItem}
                  />
                ))}
              </ToolbarGroup>
            </React.Fragment>
          ))}
        </Toolbar>
      </div>
    </TooltipProvider>
  );
}
