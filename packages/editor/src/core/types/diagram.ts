/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TDiagramSaveProps = {
  asset_id: string;
  preview_asset_id: string;
  width: number | null;
  height: number | null;
};

export type TDiagramEditorProps = {
  /** The `.drawio` source the node points at, or null to start from a blank diagram. */
  assetId: string | null;
  title: string | null;
  /** Called with the stored ids once the edit is saved; the node writes them to its attributes. */
  onSave: (props: TDiagramSaveProps) => void;
  onClose: () => void;
};

/**
 * Editing a diagram means reading the `.drawio` source and storing a new one,
 * both of which are page attachments. Page context lives in the web app, which
 * this package must not import from, so the host app injects the whole editing
 * surface and the node view only decides when to show it.
 */
export type TDiagramHandler = {
  renderEditor: (props: TDiagramEditorProps) => React.ReactNode;
};
