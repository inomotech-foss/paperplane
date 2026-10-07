// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { isApiError } from "@plane/services";

// The state views answer a duplicate name with `{ name: "<message>" }`; field validation errors are lists.
export const isStateNameTaken = (error: unknown): boolean =>
  isApiError(error) &&
  error.status === 400 &&
  typeof error.data === "object" &&
  error.data !== null &&
  typeof Reflect.get(error.data, "name") === "string";

export const serverErrorMessage = (error: unknown): string | undefined => (isApiError(error) ? error.error : undefined);
