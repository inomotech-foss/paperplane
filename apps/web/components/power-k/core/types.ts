/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { useRouter } from "next/navigation";

export type TPowerKContextType = "work-item" | "page" | "cycle" | "module";

export type TPowerKContext = {
  // Route information
  params: Record<string, string | string[] | undefined>;
  // Current user
  currentUserId?: string;
  activeCommand: TPowerKCommandConfig | null;
  // Active context
  activeContext: TPowerKContextType | null;
  shouldShowContextBasedActions: boolean;
  setShouldShowContextBasedActions: (shouldShowContextBasedActions: boolean) => void;
  // Router for navigation
  router: ReturnType<typeof useRouter>;
  // UI control
  closePalette: () => void;
  setActiveCommand: (command: TPowerKCommandConfig | null) => void;
  setActivePage: (page: TPowerKPageType | null) => void;
};

export type TPowerKPageType =
  // open entity based actions
  | "open-workspace"
  | "open-project"
  | "open-workspace-setting"
  | "open-project-cycle"
  | "open-project-module"
  | "open-project-view"
  | "open-project-setting"
  // work item context based actions
  | "update-work-item-state"
  | "update-work-item-priority"
  | "update-work-item-assignee"
  | "update-work-item-estimate"
  | "update-work-item-cycle"
  | "update-work-item-module"
  | "update-work-item-labels"
  // module context based actions
  | "update-module-member"
  | "update-module-status"
  // preferences
  | "update-theme"
  | "update-timezone"
  | "update-start-of-week"
  | "update-language";

export type TPowerKCommandGroup =
  | "contextual"
  | "navigation"
  | "create"
  | "general"
  | "settings"
  | "help"
  | "account"
  | "miscellaneous"
  | "preferences";

/** The unshifted characters `resolveShortcutKey` returns for printable keys */
export type TPowerKPrintableKey =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z"
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "`"
  | "-"
  | "="
  | "["
  | "]"
  | "\\"
  | ";"
  | "'"
  | ","
  | "."
  | "/";

type TPowerKNamedKey =
  | "space"
  | "backspace"
  | "delete"
  | "enter"
  | "escape"
  | "tab"
  | "arrowup"
  | "arrowdown"
  | "arrowleft"
  | "arrowright";

/** A bare key or Shift+key, matched on the typed-key path */
export type TPowerKTypedShortcut = TPowerKPrintableKey | `shift+${TPowerKPrintableKey}`;

type TPowerKChordKey = TPowerKPrintableKey | TPowerKNamedKey;

/** A Cmd/Ctrl or Alt chord, in the order `formatModifierShortcut` builds it */
export type TPowerKChordShortcut =
  | `cmd+${"" | "alt+"}${"" | "shift+"}${TPowerKChordKey}`
  | `alt+${"" | "shift+"}${TPowerKChordKey}`;

export type TPowerKCommandConfig = {
  // Identity
  id: string;
  i18n_title: string;
  i18n_description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconNode?: React.ReactNode;

  // Shortcuts (ONE of these)
  shortcut?: TPowerKTypedShortcut; // "c", "p", "shift+e"
  keySequence?: string; // Sequence: "gm", "op", "oc"
  modifierShortcut?: TPowerKChordShortcut; // "cmd+k", "cmd+delete", "cmd+shift+,"

  // Visibility & Context
  closeOnSelect: boolean; // Whether to close the palette after selection

  // Conditions
  isVisible: (ctx: TPowerKContext) => boolean; // Dynamic visibility
  isEnabled: (ctx: TPowerKContext) => boolean; // Dynamic enablement

  // Search
  keywords?: string[]; // Alternative search keywords
} & (
  | {
      group: Extract<TPowerKCommandGroup, "contextual">; // For UI grouping
      contextType: TPowerKContextType; // Only show when this context is active
    }
  | {
      group: Exclude<TPowerKCommandGroup, "contextual">;
    }
) &
  (
    | {
        type: "change-page";
        page: TPowerKPageType; // Opens selection page
        onSelect: (data: unknown, ctx: TPowerKContext) => void | Promise<void>; // Called after page selection
      }
    | {
        type: "action";
        action: (ctx: TPowerKContext) => void | Promise<void>; // Direct action
      }
  ) &
  (
    | {
        // Typed keys fire by accident, so state changes need a chord or the palette
        changesState: true;
        shortcut?: never;
        keySequence?: never;
      }
    | {
        changesState: false;
      }
  );

// ============================================================================
// UI State Types
// ============================================================================

export type TCommandPaletteState = {
  isOpen: boolean;
  searchTerm: string;
  activePage: TPowerKPageType | null;
  activeContext: TPowerKContextType | null;
  selectedCommand: TPowerKCommandConfig | null;
};

export type TSelectionPageProps<T = unknown> = {
  workspaceSlug: string;
  projectId?: string;
  searchTerm?: string;
  onSelect: (item: T) => void;
  onClose: () => void;
};

export type TPowerKSearchResultsKeys = "workspace" | "project" | "issue" | "cycle" | "module" | "issue_view" | "page";
