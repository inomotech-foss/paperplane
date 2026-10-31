/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useEffect, useCallback } from "react";
import { getValueFromLocalStorage as getStoredValue } from "@plane/hooks";

export { setValueIntoLocalStorage } from "@plane/hooks";

export const getValueFromLocalStorage = (key: string, defaultValue: unknown): unknown =>
  getStoredValue(key, defaultValue);

// TODO: Remove this once we migrate to the new hooks from plane/helpers
const useLocalStorage = <T,>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T | null>(() => getStoredValue(key, initialValue));

  const setValue = useCallback(
    (value: T) => {
      window.localStorage.setItem(key, JSON.stringify(value));
      setStoredValue(value);
      window.dispatchEvent(new Event(`local-storage:${key}`));
    },
    [key]
  );

  const clearValue = useCallback(() => {
    window.localStorage.removeItem(key);
    setStoredValue(null);
    window.dispatchEvent(new Event(`local-storage:${key}`));
  }, [key]);

  const reHydrate = useCallback(() => {
    const data = getStoredValue(key, initialValue);
    setStoredValue(data);
  }, [key, initialValue]);

  useEffect(() => {
    window.addEventListener(`local-storage:${key}`, reHydrate);
    return () => {
      window.removeEventListener(`local-storage:${key}`, reHydrate);
    };
  }, [key, reHydrate]);

  return { storedValue, setValue, clearValue } as const;
};

export default useLocalStorage;
