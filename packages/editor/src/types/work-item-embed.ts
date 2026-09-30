/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TWorkItemEmbedHandlerProps = {
  workItemId: string;
  projectId: string | undefined;
  workspaceSlug: string | undefined;
};

/**
 * Work item data lives in the web app's issue store, which this package must
 * not import from, so the host app injects the rendering instead.
 */
export type TWorkItemEmbedHandler = {
  renderComponent: (props: TWorkItemEmbedHandlerProps) => React.ReactNode;
};
