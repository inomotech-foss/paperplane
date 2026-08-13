/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set, unset } from "lodash-es";
import { action, observable, runInAction, makeObservable, computed } from "mobx";
// plane imports
import { InstanceOAuthApplicationService } from "@plane/services";
import type { IOAuthApplication, TLoader } from "@plane/types";
// root store
import type { RootStore } from "@/store/root.store";

export interface IOAuthApplicationStore {
  loader: TLoader;
  applications: Record<number, IOAuthApplication>;
  applicationIds: number[];
  getApplicationById: (applicationId: number) => IOAuthApplication | undefined;
  fetchApplications: () => Promise<IOAuthApplication[]>;
  createApplication: (data: Pick<IOAuthApplication, "name" | "redirect_uris">) => Promise<IOAuthApplication>;
  updateApplication: (
    applicationId: number,
    data: Partial<Pick<IOAuthApplication, "name" | "redirect_uris">>
  ) => Promise<IOAuthApplication>;
  deleteApplication: (applicationId: number) => Promise<void>;
}

export class OAuthApplicationStore implements IOAuthApplicationStore {
  loader: TLoader = "init-loader";
  applications: Record<number, IOAuthApplication> = {};
  instanceOAuthApplicationService;

  constructor(private store: RootStore) {
    makeObservable(this, {
      loader: observable,
      applications: observable,
      applicationIds: computed,
      getApplicationById: action,
      fetchApplications: action,
      createApplication: action,
      updateApplication: action,
      deleteApplication: action,
    });
    this.instanceOAuthApplicationService = new InstanceOAuthApplicationService();
  }

  get applicationIds() {
    return Object.values(this.applications)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((application) => application.id);
  }

  getApplicationById = (applicationId: number) => this.applications[applicationId];

  fetchApplications = async (): Promise<IOAuthApplication[]> => {
    try {
      this.loader = this.applicationIds.length > 0 ? "mutation" : "init-loader";
      const applications = await this.instanceOAuthApplicationService.list();
      runInAction(() => {
        this.applications = {};
        applications.forEach((application) => set(this.applications, [application.id], application));
      });
      return applications;
    } catch (error) {
      console.error("Error fetching OAuth applications", error);
      throw error;
    } finally {
      // The action's scope ended at the first await, so this needs its own.
      runInAction(() => {
        this.loader = "loaded";
      });
    }
  };

  /**
   * The created application carries client_secret. It is stored so the caller
   * can show it once, and never comes back from the listing.
   */
  createApplication = async (data: Pick<IOAuthApplication, "name" | "redirect_uris">): Promise<IOAuthApplication> => {
    try {
      this.loader = "mutation";
      const application = await this.instanceOAuthApplicationService.create(data);
      runInAction(() => {
        set(this.applications, [application.id], { ...application, client_secret: undefined });
      });
      return application;
    } catch (error) {
      console.error("Error creating OAuth application", error);
      throw error;
    } finally {
      // The action's scope ended at the first await, so this needs its own.
      runInAction(() => {
        this.loader = "loaded";
      });
    }
  };

  updateApplication = async (
    applicationId: number,
    data: Partial<Pick<IOAuthApplication, "name" | "redirect_uris">>
  ): Promise<IOAuthApplication> => {
    try {
      this.loader = "mutation";
      const application = await this.instanceOAuthApplicationService.update(applicationId, data);
      runInAction(() => {
        set(this.applications, [application.id], application);
      });
      return application;
    } catch (error) {
      console.error("Error updating OAuth application", error);
      throw error;
    } finally {
      // The action's scope ended at the first await, so this needs its own.
      runInAction(() => {
        this.loader = "loaded";
      });
    }
  };

  deleteApplication = async (applicationId: number): Promise<void> => {
    try {
      this.loader = "mutation";
      await this.instanceOAuthApplicationService.destroy(applicationId);
      runInAction(() => {
        unset(this.applications, [applicationId]);
      });
    } catch (error) {
      console.error("Error deleting OAuth application", error);
      throw error;
    } finally {
      // The action's scope ended at the first await, so this needs its own.
      runInAction(() => {
        this.loader = "loaded";
      });
    }
  };
}
