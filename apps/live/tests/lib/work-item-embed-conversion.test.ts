/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { convertHTMLDocumentToAllFormats } from "@plane/editor";

const NODE_ID = "11111111-1111-4111-8111-111111111111";
const WORK_ITEM_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const WORKSPACE_SLUG = "sample-workspace";

const WORK_ITEM_EMBED_HTML =
  `<p>before</p>` +
  `<issue-embed-component id="${NODE_ID}" entity_identifier="${WORK_ITEM_ID}" entity_name="issue" ` +
  `project_identifier="${PROJECT_ID}" workspace_identifier="${WORKSPACE_SLUG}"></issue-embed-component>` +
  `<p>after</p>`;

type TNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TNode[];
};

const findNode = (node: TNode, type: string): TNode | undefined => {
  if (node.type === type) return node;
  for (const child of node.content ?? []) {
    const match = findNode(child, type);
    if (match) return match;
  }
  return undefined;
};

/**
 * Stored HTML is converted to a Y.js binary the first time a page is opened.
 * The node has to be part of the document editor schema that conversion builds,
 * or it is dropped there with no error, long after a REST round trip passed.
 */
describe("work item embed conversion", () => {
  it("keeps the node and its attributes through the Y.js conversion", () => {
    const { description_json, description_html } = convertHTMLDocumentToAllFormats({
      document_html: WORK_ITEM_EMBED_HTML,
      variant: "document",
    });

    const embed = findNode(description_json as TNode, "issue-embed-component");

    expect(embed).toBeDefined();
    expect(embed?.attrs).toMatchObject({
      id: NODE_ID,
      entity_identifier: WORK_ITEM_ID,
      entity_name: "issue",
      project_identifier: PROJECT_ID,
      workspace_identifier: WORKSPACE_SLUG,
    });
    expect(description_html).toContain(`entity_identifier="${WORK_ITEM_ID}"`);
  });
});
