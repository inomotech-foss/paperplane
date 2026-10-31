/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
// `navigator.clipboard` is missing outside secure contexts.
const getSnapshot = () => typeof navigator.clipboard?.writeText === "function";
const getServerSnapshot = () => false;

const useClipboardWritePermission = () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

export default useClipboardWritePermission;
