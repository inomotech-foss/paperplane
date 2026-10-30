/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useEffect, useCallback } from "react";

type TValueGuard<T> = (value: unknown) => value is T;

// Accepts stored JSON whose runtime kind matches the default value.
const isSameKind =
  <T,>(sample: T): TValueGuard<T> =>
  (value: unknown): value is T =>
    typeof value === typeof sample &&
    (value === null) === (sample === null) &&
    Array.isArray(value) === Array.isArray(sample);

export const getValueFromLocalStorage = <T,>(
  key: string,
  defaultValue: T,
  isValue: TValueGuard<T> = isSameKind(defaultValue)
): T => {
  if (typeof window === "undefined") return defaultValue;
  try {
    const item = window.localStorage.getItem(key);
    if (!item) return defaultValue;
    const value: unknown = JSON.parse(item);
    return isValue(value) ? value : defaultValue;
  } catch (_error) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // storage is unavailable
    }
    return defaultValue;
  }
};

export const setValueIntoLocalStorage = (key: string, value: unknown) => {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_error) {
    return false;
  }
};

export const useLocalStorage = <T,>(key: string, initialValue: T, isValue?: TValueGuard<T>) => {
  const [storedValue, setStoredValue] = useState<T | null>(() => getValueFromLocalStorage(key, initialValue, isValue));

  const setValue = useCallback(
    (value: T) => {
      setStoredValue(value);
      // without storage the value still applies here, other instances just do not follow
      if (setValueIntoLocalStorage(key, value)) window.dispatchEvent(new Event(`local-storage:${key}`));
    },
    [key]
  );

  const clearValue = useCallback(() => {
    window.localStorage.removeItem(key);
    setStoredValue(null);
    window.dispatchEvent(new Event(`local-storage:${key}`));
  }, [key]);

  const reHydrate = useCallback(() => {
    const data = getValueFromLocalStorage(key, initialValue, isValue);
    setStoredValue(data);
  }, [key, initialValue, isValue]);

  useEffect(() => {
    window.addEventListener(`local-storage:${key}`, reHydrate);
    return () => {
      window.removeEventListener(`local-storage:${key}`, reHydrate);
    };
  }, [key, reHydrate]);

  return { storedValue, setValue, clearValue } as const;
};
