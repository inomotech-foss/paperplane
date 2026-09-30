/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TChildPagesHandlerProps = {
  depth: number;
};

/**
 * Sub-page data lives in the web app's page store, which this package must not
 * import from, so the host app injects the rendering instead.
 */
export type TChildPagesHandler = {
  renderComponent: (props: TChildPagesHandlerProps) => React.ReactNode;
};
