/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { unwrap } from "@plane/services";
import type { ICsrfTokenData, IEmailCheckData, IEmailCheckResponse } from "@plane/types";
import { apiClient } from "@/services/api-client";

/** Errors are thrown as `ApiError` from `@plane/services`. */
export class AuthService {
  async requestCSRFToken(): Promise<ICsrfTokenData> {
    return unwrap(apiClient.GET("/auth/get-csrf-token/"));
  }

  emailCheck = async (data: IEmailCheckData): Promise<IEmailCheckResponse> =>
    unwrap(apiClient.POST("/auth/email-check/", { body: data }));

  async sendResetPasswordLink(data: { email: string }): Promise<void> {
    await unwrap(apiClient.POST("/auth/forgot-password/", { body: data }));
  }

  async setPassword(token: string, data: { password: string }): Promise<void> {
    await unwrap(apiClient.POST("/auth/set-password/", { body: data, headers: { "X-CSRFTOKEN": token } }));
  }

  async generateUniqueCode(data: { email: string }): Promise<void> {
    await unwrap(apiClient.POST("/auth/magic-generate/", { body: data }));
  }

  /** Signs out with a form post, so the browser follows the redirect the API answers with. */
  async signOut(baseUrl: string): Promise<void> {
    const { csrf_token: csrfToken } = await this.requestCSRFToken();
    if (!csrfToken) throw Error("CSRF token not found");

    const form = document.createElement("form");
    const element1 = document.createElement("input");

    form.method = "POST";
    form.action = `${baseUrl}/auth/sign-out/`;

    element1.value = csrfToken;
    element1.name = "csrfmiddlewaretoken";
    element1.type = "hidden";
    form.appendChild(element1);

    document.body.appendChild(form);

    form.submit();
  }
}
