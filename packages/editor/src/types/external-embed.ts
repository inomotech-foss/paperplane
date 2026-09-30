/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TEmbedRenderProps = {
  url: string | null;
  width: string | null;
  height: string | null;
  /** Absent when the editor is read only. */
  onUrlChange?: (url: string) => void;
};

/**
 * Whether a URL's origin may be framed comes from the instance config, which
 * lives in the web app, so the host app injects the rendering instead of this
 * package importing from there.
 */
export type TEmbedHandler = {
  renderComponent: (props: TEmbedRenderProps) => React.ReactNode;
};
