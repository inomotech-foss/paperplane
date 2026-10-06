// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useContext } from "react";
import { StoreContext } from "@/lib/store-context";
import type { IProjectLinkStore } from "@/store/project/project-link.store";

export const useProjectLink = (): IProjectLinkStore => {
  const context = useContext(StoreContext);
  if (context === undefined) throw new Error("useProjectLink must be used within StoreProvider");
  return context.projectRoot.link;
};
