// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { InternalPaths } from "@plane/api-types";
import { API_BASE_URL } from "@plane/constants";
import { createApiClient } from "@plane/services";

export function redirectToSignIn() {
  const currentPath = window.location.pathname;
  // The entry page ("/") runs its own current-user request on mount;
  // when the session is expired that request 401s too, and redirecting
  // "/" to "/?next_path=/" reloads the page in an endless loop instead of
  // letting the sign-in screen render. Only bounce away from private
  // routes.
  if (currentPath !== "/") {
    window.location.replace(`/${currentPath ? `?next_path=${encodeURIComponent(currentPath)}` : ``}`);
  }
}

/** Typed client for the internal API. A 401 sends the user to sign in. */
export const apiClient = createApiClient<InternalPaths>(API_BASE_URL, { onUnauthorized: redirectToSignIn });
