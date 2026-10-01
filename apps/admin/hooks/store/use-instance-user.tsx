/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { use } from "react";
// store
import { StoreContext } from "@/providers/store-context";
import type { IInstanceUserStore } from "@/store/instance-user.store";

export const useInstanceUser = (): IInstanceUserStore => {
  const context = use(StoreContext);
  if (context === undefined) throw new Error("useInstanceUser must be used within StoreProvider");
  return context.instanceUser;
};
