/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { setToast } from "@plane/blocks/toast";
import { AuthService } from "@plane/services";

const authService = new AuthService();

/** Fetches the CSRF token the auth forms post. A failure shows a toast, as the form cannot be sent without it. */
export function loadCsrfToken(onToken: (token: string) => void): void {
  authService
    .requestCSRFToken()
    .then((data) => data.csrf_token && onToken(data.csrf_token))
    .catch(() =>
      setToast({
        type: "error",
        title: "Error!",
        message: "Could not load the security token. Reload the page and try again.",
      })
    );
}
