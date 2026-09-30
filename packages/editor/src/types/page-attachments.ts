/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/**
 * Attachment data comes from the web app's page attachment service, which this
 * package must not import from, so the host app injects the rendering instead.
 */
export type TPageAttachmentsHandler = {
  renderComponent: () => React.ReactNode;
};
