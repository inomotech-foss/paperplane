/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
// plane imports
import type { JSONContent } from "@plane/types";
// local imports
import { PAGE_DIFF_DELETE_COLOR, PAGE_DIFF_INSERT_COLOR, buildPageVersionDiff } from "./diff";

const paragraph = (text: string): JSONContent => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

const doc = (...blocks: JSONContent[]): JSONContent => ({ type: "doc", content: blocks });

const backgroundOf = (node: JSONContent | undefined): unknown =>
  node?.marks?.find((mark) => mark.type === "customColor")?.attrs?.backgroundColor;

/** Every text node in the tree, depth first. */
const textNodes = (node: JSONContent): JSONContent[] =>
  node.type === "text" ? [node] : (node.content ?? []).flatMap(textNodes);

describe("buildPageVersionDiff", () => {
  it("leaves an unchanged document unmarked", () => {
    const source = doc(paragraph("one"), paragraph("two"));

    const result = buildPageVersionDiff(source, source);

    expect(result.content).toHaveLength(2);
    expect(textNodes(result).map(backgroundOf)).toEqual([undefined, undefined]);
  });

  it("marks a pure insertion green and leaves surrounding blocks alone", () => {
    const previous = doc(paragraph("one"));
    const current = doc(paragraph("one"), paragraph("two"));

    const result = buildPageVersionDiff(previous, current);

    expect(result.content).toHaveLength(2);
    expect(backgroundOf(textNodes(result)[0])).toBeUndefined();
    expect(backgroundOf(textNodes(result)[1])).toBe(PAGE_DIFF_INSERT_COLOR);
  });

  it("marks a pure deletion peach and keeps the removed text visible", () => {
    const previous = doc(paragraph("one"), paragraph("two"));
    const current = doc(paragraph("one"));

    const result = buildPageVersionDiff(previous, current);

    expect(result.content).toHaveLength(2);
    const texts = textNodes(result);
    expect(texts[1].text).toBe("two");
    expect(backgroundOf(texts[1])).toBe(PAGE_DIFF_DELETE_COLOR);
  });

  it("word diffs a replaced paragraph into one block", () => {
    const previous = doc(paragraph("the quick brown fox"));
    const current = doc(paragraph("the quick red fox"));

    const result = buildPageVersionDiff(previous, current);

    expect(result.content).toHaveLength(1);
    const runs = textNodes(result).map((node) => [node.text, backgroundOf(node)]);
    expect(runs).toContainEqual(["brown", PAGE_DIFF_DELETE_COLOR]);
    expect(runs).toContainEqual(["red", PAGE_DIFF_INSERT_COLOR]);
    expect(runs.some(([text, color]) => text === "the quick " && color === undefined)).toBe(true);
  });

  it("marks every block green when the original is empty", () => {
    const current = doc(paragraph("one"), paragraph("two"));

    const result = buildPageVersionDiff({ type: "doc", content: [] }, current);

    expect(textNodes(result).map(backgroundOf)).toEqual([PAGE_DIFF_INSERT_COLOR, PAGE_DIFF_INSERT_COLOR]);
  });

  it("marks every block peach when the current document is empty", () => {
    const previous = doc(paragraph("one"));

    const result = buildPageVersionDiff(previous, undefined);

    expect(textNodes(result).map(backgroundOf)).toEqual([PAGE_DIFF_DELETE_COLOR]);
  });

  it("handles a change in block count around an edit", () => {
    const previous = doc(paragraph("intro"), paragraph("body text"));
    const current = doc(paragraph("intro"), paragraph("body copy"), paragraph("outro"));

    const result = buildPageVersionDiff(previous, current);

    const runs = textNodes(result).map((node) => [node.text, backgroundOf(node)]);
    expect(runs).toContainEqual(["intro", undefined]);
    expect(runs).toContainEqual(["text", PAGE_DIFF_DELETE_COLOR]);
    expect(runs).toContainEqual(["copy", PAGE_DIFF_INSERT_COLOR]);
    expect(runs).toContainEqual(["outro", PAGE_DIFF_INSERT_COLOR]);
  });

  it("paints a whole block when the block types differ", () => {
    const previous = doc(paragraph("heading text"));
    const current = doc({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "heading text" }] });

    const result = buildPageVersionDiff(previous, current);

    expect(result.content).toHaveLength(2);
    expect(result.content?.[0].type).toBe("paragraph");
    expect(result.content?.[1].type).toBe("heading");
    expect(textNodes(result).map(backgroundOf)).toEqual([PAGE_DIFF_DELETE_COLOR, PAGE_DIFF_INSERT_COLOR]);
  });

  it("paints nested blocks and replaces an author highlight", () => {
    const previous = doc(paragraph("kept"));
    const current = doc(paragraph("kept"), {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "item", marks: [{ type: "customColor", attrs: { backgroundColor: "pink" } }] },
              ],
            },
          ],
        },
      ],
    });

    const result = buildPageVersionDiff(previous, current);

    const item = textNodes(result)[1];
    expect(item.text).toBe("item");
    expect(item.marks).toHaveLength(1);
    expect(backgroundOf(item)).toBe(PAGE_DIFF_INSERT_COLOR);
  });
});
