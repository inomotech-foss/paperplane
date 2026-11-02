/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Schema } from "@tiptap/pm/model";
import { yXmlFragmentToProseMirrorRootNode } from "@tiptap/y-tiptap";
import type * as Y from "yjs";

/** Reads the typed title text from the Yjs fragment, with no HTML round trip. */
export const extractTitleText = (title: Y.XmlFragment, schema: Schema): string =>
  yXmlFragmentToProseMirrorRootNode(title, schema).textContent.trim();
