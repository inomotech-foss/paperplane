/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { orderBy, set, unset } from "lodash-es";
import { action, computed, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
// plane imports
import { AutomationService } from "@plane/services";
import type {
  TAutomation,
  TAutomationAction,
  TAutomationActionPayload,
  TAutomationMetadata,
  TAutomationPayload,
  TAutomationRun,
} from "@plane/types";
// store
import type { CoreRootStore } from "@/store/root.store";

export type TAutomationScopeKey = string;

export interface IAutomationStore {
  // observables
  loader: boolean;
  metadata: TAutomationMetadata | undefined;
  automationMap: Record<string, TAutomation>;
  runsMap: Record<string, TAutomationRun[]>;
  /** Scope keys ("workspace" or a project id) whose list has been fetched. */
  fetchedScopes: Record<TAutomationScopeKey, boolean>;
  // computed
  workspaceAutomationIds: string[];
  // computed actions
  getAutomationById: (automationId: string) => TAutomation | undefined;
  getProjectAutomations: (projectId: string) => TAutomation[] | undefined;
  getWorkspaceAutomations: () => TAutomation[] | undefined;
  getRunsForAutomation: (automationId: string) => TAutomationRun[] | undefined;
  // fetch actions
  fetchMetadata: (workspaceSlug: string) => Promise<TAutomationMetadata | undefined>;
  fetchAutomations: (workspaceSlug: string, projectId?: string) => Promise<TAutomation[] | undefined>;
  fetchAutomationDetails: (
    workspaceSlug: string,
    automationId: string,
    projectId?: string
  ) => Promise<TAutomation | undefined>;
  fetchRuns: (workspaceSlug: string, automationId: string, projectId?: string) => Promise<TAutomationRun[]>;
  // CRUD actions
  createAutomation: (workspaceSlug: string, data: TAutomationPayload, projectId?: string) => Promise<TAutomation>;
  updateAutomation: (
    workspaceSlug: string,
    automationId: string,
    data: TAutomationPayload,
    projectId?: string
  ) => Promise<TAutomation>;
  deleteAutomation: (workspaceSlug: string, automationId: string, projectId?: string) => Promise<void>;
  createAction: (
    workspaceSlug: string,
    automationId: string,
    data: TAutomationActionPayload,
    projectId?: string
  ) => Promise<TAutomationAction>;
  updateAction: (
    workspaceSlug: string,
    automationId: string,
    actionId: string,
    data: TAutomationActionPayload,
    projectId?: string
  ) => Promise<TAutomationAction>;
  deleteAction: (workspaceSlug: string, automationId: string, actionId: string, projectId?: string) => Promise<void>;
  runNow: (workspaceSlug: string, automationId: string, projectId?: string) => Promise<void>;
}

/** Scope key used by `fetchedScopes`; workspace-scoped lists share one bucket. */
const scopeKey = (projectId?: string): TAutomationScopeKey => projectId ?? "workspace";

export class AutomationStore implements IAutomationStore {
  // observables
  loader: boolean = false;
  metadata: TAutomationMetadata | undefined = undefined;
  automationMap: Record<string, TAutomation> = {};
  runsMap: Record<string, TAutomationRun[]> = {};
  fetchedScopes: Record<TAutomationScopeKey, boolean> = {};
  // root store
  rootStore: CoreRootStore;
  // services
  automationService: AutomationService;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      // observables
      loader: observable.ref,
      metadata: observable,
      automationMap: observable,
      runsMap: observable,
      fetchedScopes: observable,
      // computed
      workspaceAutomationIds: computed,
      // fetch actions
      fetchMetadata: action,
      fetchAutomations: action,
      fetchAutomationDetails: action,
      fetchRuns: action,
      // CRUD actions
      createAutomation: action,
      updateAutomation: action,
      deleteAutomation: action,
      createAction: action,
      updateAction: action,
      deleteAction: action,
    });

    this.rootStore = _rootStore;
    this.automationService = new AutomationService();
  }

  get workspaceAutomationIds() {
    return Object.keys(this.automationMap).filter((id) => this.automationMap[id]?.scope === "workspace");
  }

  getAutomationById = computedFn((automationId: string) => this.automationMap[automationId]);

  /**
   * Newest first, matching the API ordering. Returns `undefined` until the
   * project's list has been fetched so callers can tell "empty" from "unknown".
   */
  getProjectAutomations = computedFn((projectId: string) => {
    if (!this.fetchedScopes[projectId]) return undefined;
    return orderBy(
      Object.values(this.automationMap).filter(
        (automation) => automation.scope === "project" && automation.project === projectId
      ),
      "created_at",
      "desc"
    );
  });

  getWorkspaceAutomations = computedFn(() => {
    if (!this.fetchedScopes.workspace) return undefined;
    return orderBy(
      Object.values(this.automationMap).filter((automation) => automation.scope === "workspace"),
      "created_at",
      "desc"
    );
  });

  getRunsForAutomation = computedFn((automationId: string) => this.runsMap[automationId]);

  fetchMetadata = async (workspaceSlug: string) => {
    // The catalog is static per deployment, so fetch it at most once.
    if (this.metadata) return this.metadata;
    const metadata = await this.automationService.metadata(workspaceSlug);
    runInAction(() => {
      this.metadata = metadata;
    });
    return metadata;
  };

  fetchAutomations = async (workspaceSlug: string, projectId?: string) => {
    try {
      runInAction(() => {
        this.loader = true;
      });
      const automations = await this.automationService.list(workspaceSlug, projectId);
      runInAction(() => {
        automations.forEach((automation) => set(this.automationMap, [automation.id], automation));
        set(this.fetchedScopes, [scopeKey(projectId)], true);
        this.loader = false;
      });
      return automations;
    } catch (error) {
      runInAction(() => {
        this.loader = false;
      });
      throw error;
    }
  };

  fetchAutomationDetails = async (workspaceSlug: string, automationId: string, projectId?: string) => {
    const automation = await this.automationService.retrieve(workspaceSlug, automationId, projectId);
    runInAction(() => {
      set(this.automationMap, [automation.id], automation);
    });
    return automation;
  };

  fetchRuns = async (workspaceSlug: string, automationId: string, projectId?: string) => {
    const response = await this.automationService.listRuns(workspaceSlug, automationId, projectId);
    runInAction(() => {
      set(this.runsMap, [automationId], response.results);
    });
    return response.results;
  };

  createAutomation = async (workspaceSlug: string, data: TAutomationPayload, projectId?: string) => {
    const automation = await this.automationService.create(workspaceSlug, data, projectId);
    runInAction(() => {
      set(this.automationMap, [automation.id], automation);
    });
    return automation;
  };

  updateAutomation = async (
    workspaceSlug: string,
    automationId: string,
    data: TAutomationPayload,
    projectId?: string
  ) => {
    const automation = await this.automationService.update(workspaceSlug, automationId, data, projectId);
    runInAction(() => {
      set(this.automationMap, [automation.id], automation);
    });
    return automation;
  };

  deleteAutomation = async (workspaceSlug: string, automationId: string, projectId?: string) => {
    await this.automationService.destroy(workspaceSlug, automationId, projectId);
    runInAction(() => {
      unset(this.automationMap, [automationId]);
      unset(this.runsMap, [automationId]);
    });
  };

  createAction = async (
    workspaceSlug: string,
    automationId: string,
    data: TAutomationActionPayload,
    projectId?: string
  ) => {
    const created = await this.automationService.createAction(workspaceSlug, automationId, data, projectId);
    runInAction(() => {
      const automation = this.automationMap[automationId];
      if (automation) {
        set(this.automationMap, [automationId, "actions"], [...automation.actions, created]);
      }
    });
    return created;
  };

  updateAction = async (
    workspaceSlug: string,
    automationId: string,
    actionId: string,
    data: TAutomationActionPayload,
    projectId?: string
  ) => {
    const updated = await this.automationService.updateAction(workspaceSlug, automationId, actionId, data, projectId);
    runInAction(() => {
      const automation = this.automationMap[automationId];
      if (automation) {
        set(
          this.automationMap,
          [automationId, "actions"],
          automation.actions.map((action) => (action.id === actionId ? updated : action))
        );
      }
    });
    return updated;
  };

  deleteAction = async (workspaceSlug: string, automationId: string, actionId: string, projectId?: string) => {
    await this.automationService.destroyAction(workspaceSlug, automationId, actionId, projectId);
    runInAction(() => {
      const automation = this.automationMap[automationId];
      if (automation) {
        set(
          this.automationMap,
          [automationId, "actions"],
          automation.actions.filter((action) => action.id !== actionId)
        );
      }
    });
  };

  runNow = async (workspaceSlug: string, automationId: string, projectId?: string) => {
    await this.automationService.runNow(workspaceSlug, automationId, projectId);
  };
}
