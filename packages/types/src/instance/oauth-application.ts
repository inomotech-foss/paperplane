/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export interface IOAuthApplication {
  id: number;
  name: string;
  client_id: string;
  /** One URI per line, as django-oauth-toolkit stores them. */
  redirect_uris: string;
  /** Live grants across all users. Revoking the application takes them with it. */
  installations: number;
  /** Provisioned by the chart, so edits here would revert on the next deploy. */
  managed: boolean;
  created: string;
  /** Returned once, on creation. */
  client_secret?: string;
}
