/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane admin store
import type { TRootStoreInitialData } from "@/store/root.store";
import { StoreContext, rootStore } from "./store-context";

function initializeStore(initialData: TRootStoreInitialData) {
  // Hydrate the shared client-side store with any initial data before use.
  if (initialData) {
    rootStore.hydrate(initialData);
  }
  return rootStore;
}

export type StoreProviderProps = {
  children: React.ReactNode;
  initialState?: TRootStoreInitialData;
};

export function StoreProvider({ children, initialState = {} }: StoreProviderProps) {
  const store = initializeStore(initialState);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
