/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { mergeAttributes, Node } from "@tiptap/core";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";

export const DEFAULT_QUERY_BLOCK_KIND = "recent";
export const DEFAULT_QUERY_BLOCK_SCOPE = "page";
export const MAX_QUERY_BLOCK_DEPTH = 20;

const KINDS = [
  "tree",
  "index",
  "recent",
  "search",
  "contributors",
  "by-label",
  "label-list",
  "page-properties",
];
const SCOPES = ["page", "project", "workspace"];

function pick(value: string | null, allowed: string[], fallback: string) {
  return value && allowed.includes(value) ? value : fallback;
}

function optionalNumber(value: string | null, max: number) {
  const parsed = Number(value);
  if (!value || !Number.isFinite(parsed) || parsed < 1) return null;
  return Math.min(Math.trunc(parsed), max);
}

/**
 * A live listing of pages, whose `kind` picks the query. Attributes are flat
 * strings rather than one JSON blob so the API sanitiser can allow them by
 * name, and so nothing has to survive quote escaping through the HTML and
 * Y.js round-trips.
 */
export const QueryBlockExtensionConfig = Node.create({
  name: CORE_EXTENSIONS.QUERY_BLOCK,
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      kind: {
        default: DEFAULT_QUERY_BLOCK_KIND,
        parseHTML: (element) => pick(element.getAttribute("kind"), KINDS, DEFAULT_QUERY_BLOCK_KIND),
      },
      scope: {
        default: DEFAULT_QUERY_BLOCK_SCOPE,
        parseHTML: (element) => pick(element.getAttribute("scope"), SCOPES, DEFAULT_QUERY_BLOCK_SCOPE),
      },
      "root-page-id": {
        default: null,
      },
      depth: {
        default: null,
        parseHTML: (element) => optionalNumber(element.getAttribute("depth"), MAX_QUERY_BLOCK_DEPTH),
      },
      limit: {
        default: null,
        parseHTML: (element) => optionalNumber(element.getAttribute("limit"), Number.MAX_SAFE_INTEGER),
      },
      sort: {
        default: null,
      },
      reverse: {
        default: null,
      },
      labels: {
        default: null,
      },
      placeholder: {
        default: null,
      },
      columns: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: "query-block-component" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["query-block-component", mergeAttributes(HTMLAttributes)];
  },
});
