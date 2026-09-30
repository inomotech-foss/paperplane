/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/**
 * One node covers every query the Confluence importer needs, because the only
 * thing that differs between them is which pages to list. Adding a query is a
 * new kind plus a case in the host app, never a new extension.
 */
export type TQueryBlockKind =
  | "tree"
  | "index"
  | "recent"
  | "search"
  | "contributors"
  | "by-label"
  | "label-list"
  | "page-properties"
  | "task-report"
  | "decision-report";

export type TQueryBlockScope = "page" | "project" | "workspace";

export type TQueryBlockHandlerProps = {
  kind: TQueryBlockKind;
  scope: TQueryBlockScope;
  rootPageId: string | undefined;
  depth: number | undefined;
  limit: number | undefined;
  sort: string | undefined;
  reverse: boolean;
  labels: string[];
  placeholder: string | undefined;
  /** The property names to show as columns, in order. */
  columns: string[];
  /** Task reports may list only the ticked or only the open items. */
  status: "complete" | "incomplete" | undefined;
};

/**
 * Page data lives in the web app's stores and API services, which this package
 * must not import from, so the host app injects the rendering instead.
 */
export type TQueryBlockHandler = {
  renderComponent: (props: TQueryBlockHandlerProps) => React.ReactNode;
};
