/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// store
import { CoreRootStore } from "@/store/root.store";
import type { IAutomationStore } from "./automation.store";
import { AutomationStore } from "./automation.store";
import type { ITimelineStore } from "./timeline";
import { TimeLineStore } from "./timeline";

export class RootStore extends CoreRootStore {
  timelineStore: ITimelineStore;
  automation: IAutomationStore;

  constructor() {
    super();

    this.timelineStore = new TimeLineStore(this);
    this.automation = new AutomationStore(this);
  }
}
