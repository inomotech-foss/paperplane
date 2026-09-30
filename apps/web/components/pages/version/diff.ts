/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { diffArrays, diffWords } from "diff";
// plane imports
import type { JSONContent } from "@plane/types";

export const PAGE_DIFF_INSERT_COLOR = "green";
export const PAGE_DIFF_DELETE_COLOR = "peach";

const CUSTOM_COLOR_MARK = "customColor";

type Mark = NonNullable<JSONContent["marks"]>[number];

const isTextNode = (node: JSONContent): boolean => node.type === "text";

/** A block is word-diffable only when its children are all plain text. */
const isInlineTextBlock = (node: JSONContent): boolean =>
  Array.isArray(node.content) && node.content.length > 0 && node.content.every(isTextNode);

const colorMark = (color: string): Mark => ({
  type: CUSTOM_COLOR_MARK,
  attrs: { color: null, backgroundColor: color },
});

/** Any highlight the author set would read as diff output, so it is replaced. */
const withColorMark = (marks: JSONContent["marks"], color: string): Mark[] => [
  ...(marks ?? []).filter((mark) => mark.type !== CUSTOM_COLOR_MARK),
  colorMark(color),
];

const paintNode = (node: JSONContent, color: string): JSONContent => {
  if (isTextNode(node)) return { ...node, marks: withColorMark(node.marks, color) };
  if (!Array.isArray(node.content)) return node;
  return { ...node, content: node.content.map((child) => paintNode(child, color)) };
};

const textOf = (node: JSONContent): string => {
  if (isTextNode(node)) return node.text ?? "";
  if (!Array.isArray(node.content)) return "";
  return node.content.map(textOf).join("");
};

const wordDiffBlock = (previous: JSONContent, current: JSONContent): JSONContent => {
  const content: JSONContent[] = [];

  for (const part of diffWords(textOf(previous), textOf(current))) {
    if (!part.value) continue;
    const node: JSONContent = { type: "text", text: part.value };
    if (part.added) node.marks = [colorMark(PAGE_DIFF_INSERT_COLOR)];
    if (part.removed) node.marks = [colorMark(PAGE_DIFF_DELETE_COLOR)];
    content.push(node);
  }

  const block: JSONContent = { ...current };
  if (content.length > 0) block.content = content;
  else delete block.content;
  return block;
};

/** Pair each removed block with the added block that replaced it. */
const diffReplacedBlocks = (removed: JSONContent[], added: JSONContent[]): JSONContent[] => {
  const paired = Math.min(removed.length, added.length);
  const blocks: JSONContent[] = [];

  for (let index = 0; index < paired; index++) {
    const before = removed[index];
    const after = added[index];
    if (before.type === after.type && isInlineTextBlock(before) && isInlineTextBlock(after)) {
      blocks.push(wordDiffBlock(before, after));
    } else {
      blocks.push(paintNode(before, PAGE_DIFF_DELETE_COLOR), paintNode(after, PAGE_DIFF_INSERT_COLOR));
    }
  }

  for (const block of removed.slice(paired)) blocks.push(paintNode(block, PAGE_DIFF_DELETE_COLOR));
  for (const block of added.slice(paired)) blocks.push(paintNode(block, PAGE_DIFF_INSERT_COLOR));

  return blocks;
};

/**
 * Merge two page versions into a single document that highlights the change.
 *
 * Blocks are matched with an LCS over their serialised form, so a block that
 * moved or survived untouched stays unmarked. Blocks that changed in place get
 * a word-level diff; everything else is painted whole.
 */
export const buildPageVersionDiff = (
  previous: JSONContent | undefined,
  current: JSONContent | undefined
): JSONContent => {
  const previousBlocks = previous?.content ?? [];
  const currentBlocks = current?.content ?? [];

  const parts = diffArrays(
    previousBlocks.map((block) => JSON.stringify(block)),
    currentBlocks.map((block) => JSON.stringify(block))
  );

  const content: JSONContent[] = [];
  let previousIndex = 0;
  let currentIndex = 0;

  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    const count = part.value.length;

    if (!part.added && !part.removed) {
      content.push(...currentBlocks.slice(currentIndex, currentIndex + count));
      previousIndex += count;
      currentIndex += count;
      continue;
    }

    if (part.added) {
      content.push(
        ...currentBlocks
          .slice(currentIndex, currentIndex + count)
          .map((block) => paintNode(block, PAGE_DIFF_INSERT_COLOR))
      );
      currentIndex += count;
      continue;
    }

    const removed = previousBlocks.slice(previousIndex, previousIndex + count);
    previousIndex += count;

    const next = parts[index + 1];
    if (!next?.added) {
      content.push(...removed.map((block) => paintNode(block, PAGE_DIFF_DELETE_COLOR)));
      continue;
    }

    const added = currentBlocks.slice(currentIndex, currentIndex + next.value.length);
    currentIndex += next.value.length;
    index++;
    content.push(...diffReplacedBlocks(removed, added));
  }

  return { type: current?.type ?? "doc", content };
};
