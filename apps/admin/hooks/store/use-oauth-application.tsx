/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useContext } from "react";
// store
import { StoreContext } from "@/providers/store-context";
import type { IOAuthApplicationStore } from "@/store/oauth-application.store";

export const useOAuthApplication = (): IOAuthApplicationStore => {
  const context = useContext(StoreContext);
  if (context === undefined) throw new Error("useOAuthApplication must be used within StoreProvider");
  return context.oauthApplication;
};
