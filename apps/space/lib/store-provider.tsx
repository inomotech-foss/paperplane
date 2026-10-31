/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { createContext } from "react";
// plane web store
import { RootStore } from "@/store/root.store";

let rootStore = new RootStore();

export const StoreContext = createContext(rootStore);

function initializeStore() {
  const singletonRootStore = rootStore ?? new RootStore();
  // For SSG and SSR always create a new store
  if (typeof window === "undefined") return singletonRootStore;
  // Create the store once in the client
  if (!rootStore) rootStore = singletonRootStore;
  return singletonRootStore;
}

export type StoreProviderProps = {
  children: React.ReactNode;
};

export function StoreProvider({ children }: StoreProviderProps) {
  const store = initializeStore();
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
