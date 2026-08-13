/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export interface IConnectedAppWorkspace {
  id: string;
  name: string;
  slug: string;
}

export interface IConnectedApp {
  id: number;
  name: string;
  /** Workspaces the application may act in on this user's behalf. */
  workspaces: IConnectedAppWorkspace[];
  connected_at: string;
}
