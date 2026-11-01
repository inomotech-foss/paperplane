/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useProjectsAppPowerKCommands } from "./commands";

const noop = () => {};
const asyncNoop = async () => {};
const returnsUndefined = () => undefined;

vi.mock("next/navigation", () => ({ useParams: () => ({}) }));
vi.mock("next-themes", () => ({ useTheme: () => ({ setTheme: noop }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: noop }) }));
vi.mock("@/hooks/store", () => ({
  EPageStoreType: { PROJECT: "PROJECT_PAGE" },
  usePageStore: () => ({ getPageById: returnsUndefined }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({
    data: undefined,
    canPerformAnyCreateAction: true,
    permission: { allowPermissions: () => true },
    signOut: asyncNoop,
    updateCurrentUser: asyncNoop,
  }),
  useUserProfile: () => ({ updateUserProfile: asyncNoop, updateUserTheme: asyncNoop }),
}));
vi.mock("@/hooks/store/use-instance", () => ({ useInstance: () => ({ config: undefined }) }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({
    workspaceProjectIds: [],
    getProjectById: returnsUndefined,
    getPartialProjectById: returnsUndefined,
  }),
}));
vi.mock("@/hooks/store/use-command-palette", () => ({
  useCommandPalette: () => ({
    toggleCreateIssueModal: noop,
    toggleCreateProjectModal: noop,
    toggleCreateCycleModal: noop,
    toggleCreateModuleModal: noop,
    toggleCreateViewModal: noop,
    toggleCreatePageModal: noop,
    toggleDeleteIssueModal: noop,
  }),
}));
vi.mock("@/hooks/store/use-power-k", () => ({
  usePowerK: () => ({ toggleShortcutsListModal: noop, topNavInputRef: undefined }),
}));
vi.mock("@/hooks/store/use-app-theme", () => ({ useAppTheme: () => ({ toggleSidebar: noop }) }));
vi.mock("@/hooks/store/estimates", () => ({
  useProjectEstimates: () => ({ areEstimateEnabledByProjectId: () => false }),
}));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    issue: {
      getIssueById: returnsUndefined,
      getIssueIdByIdentifier: returnsUndefined,
      addCycleToIssue: asyncNoop,
      removeIssueFromCycle: asyncNoop,
      changeModulesInIssue: asyncNoop,
    },
    subscription: {
      getSubscriptionByIssueId: returnsUndefined,
      createSubscription: asyncNoop,
      removeSubscription: asyncNoop,
    },
    updateIssue: asyncNoop,
  }),
}));
vi.mock("@/hooks/store/use-cycle", () => ({
  useCycle: () => ({
    getCycleById: returnsUndefined,
    addCycleToFavorites: asyncNoop,
    removeCycleFromFavorites: asyncNoop,
  }),
}));
vi.mock("@/hooks/store/use-module", () => ({
  useModule: () => ({
    getModuleById: returnsUndefined,
    addModuleToFavorites: asyncNoop,
    removeModuleFromFavorites: asyncNoop,
    updateModuleDetails: asyncNoop,
  }),
}));

const renderCommands = () => renderHook(() => useProjectsAppPowerKCommands()).result.current;

describe("Power K shortcut policy", () => {
  it("binds state-changing commands only to chords", () => {
    const violations = renderCommands()
      .filter((command) => command.type === "action" && command.changesState)
      .filter((command) => command.shortcut !== undefined || command.keySequence !== undefined)
      .map((command) => command.id);

    expect(violations).toEqual([]);
  });

  it("uses Cmd/Ctrl or Alt for every modifier shortcut", () => {
    const shiftOnly = renderCommands()
      .filter((command) => command.modifierShortcut && !/^(cmd|alt)\+/.test(command.modifierShortcut))
      .map((command) => command.id);

    expect(shiftOnly).toEqual([]);
  });

  it("marks toggles, subscriptions and deletes as state-changing", () => {
    const stateChanging = new Set(
      renderCommands()
        .filter((command) => command.type === "action" && command.changesState)
        .map((command) => command.id)
    );

    for (const id of [
      "toggle_page_favorite",
      "toggle_cycle_favorite",
      "toggle_module_favorite",
      "subscribe_work_item",
      "assign_work_item_to_me",
      "delete_work_item",
    ]) {
      expect(stateChanging).toContain(id);
    }
  });
});
