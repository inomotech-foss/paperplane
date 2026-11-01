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
  TAutomationActionCreatePayload,
  TAutomationActionPayload,
  TAutomationMetadata,
  TAutomationPayload,
  TAutomationRun,
} from "@plane/types";
// store

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
    data: TAutomationActionCreatePayload,
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
  // services
  automationService: AutomationService;
  // latest updateAction request per action, so an older response cannot overwrite a newer edit
  private actionRequests: Record<string, number> = {};
  private pendingActionRequests: Record<string, number> = {};
  // the newest action state the server returned, with the request that returned it
  private confirmedActions: Record<string, { action: TAutomationAction; request: number }> = {};

  constructor() {
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
    data: TAutomationActionCreatePayload,
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
    const request = (this.actionRequests[actionId] ?? 0) + 1;
    this.actionRequests[actionId] = request;
    const current = this.automationMap[automationId]?.actions.find((item) => item.id === actionId);
    // With nothing in flight the stored action is what the server last returned.
    if (current && !this.pendingActionRequests[actionId])
      this.confirmedActions[actionId] = { action: current, request: 0 };
    this.pendingActionRequests[actionId] = (this.pendingActionRequests[actionId] ?? 0) + 1;
    // Applied before the request, so an edit to another field of the same action builds on it.
    if (current && data.config !== undefined) this.replaceAction(automationId, { ...current, config: data.config });
    try {
      const updated = await this.automationService.updateAction(workspaceSlug, automationId, actionId, data, projectId);
      const confirmed = this.confirmedActions[actionId];
      if (!confirmed || request > confirmed.request) this.confirmedActions[actionId] = { action: updated, request };
      return updated;
    } finally {
      const pending = (this.pendingActionRequests[actionId] ?? 1) - 1;
      this.pendingActionRequests[actionId] = pending;
      // Once the newest edit or the last request settles, show what the server holds. A refused edit
      // therefore falls back to the last accepted state, never to another optimistic one.
      const confirmed = this.confirmedActions[actionId];
      if (confirmed && (pending === 0 || this.actionRequests[actionId] === request)) {
        runInAction(() => this.replaceAction(automationId, confirmed.action));
      }
    }
  };

  private replaceAction = (automationId: string, next: TAutomationAction) => {
    const automation = this.automationMap[automationId];
    if (!automation) return;
    set(
      this.automationMap,
      [automationId, "actions"],
      automation.actions.map((item) => (item.id === next.id ? next : item))
    );
  };

  deleteAction = async (workspaceSlug: string, automationId: string, actionId: string, projectId?: string) => {
    await this.automationService.destroyAction(workspaceSlug, automationId, actionId, projectId);
    delete this.confirmedActions[actionId];
    delete this.pendingActionRequests[actionId];
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
