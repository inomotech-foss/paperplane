/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { findChildren } from "@tiptap/core";
import type { Node as ProsemirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import highlight from "highlight.js/lib/core";
import type { createLowlight } from "lowlight";
// helpers
import { readNumber } from "@plane/types";

export type Lowlight = ReturnType<typeof createLowlight>;
type HighlightNode = ReturnType<Lowlight["highlight"]>["children"][number];

function nodeClassNames(node: HighlightNode): string[] {
  if (node.type !== "element") return [];
  const className = node.properties.className;
  if (Array.isArray(className)) return className.map(String);
  return className === undefined || className === null ? [] : [String(className)];
}

function parseNodes(nodes: HighlightNode[], className: string[] = []): { text: string; classes: string[] }[] {
  return nodes.flatMap((node) => {
    const classes = [...className, ...nodeClassNames(node)];

    if (node.type === "element") {
      return parseNodes(node.children, classes);
    }

    return {
      text: node.type === "doctype" ? "" : node.value,
      classes,
    };
  });
}

function registered(aliasOrLanguage: string) {
  return Boolean(highlight.getLanguage(aliasOrLanguage));
}

function getDecorations({
  doc,
  name,
  lowlight,
  defaultLanguage,
}: {
  doc: ProsemirrorNode;
  name: string;
  lowlight: Lowlight;
  defaultLanguage: string | null | undefined;
}) {
  const decorations: Decoration[] = [];

  findChildren(doc, (node) => node.type.name === name).forEach((block) => {
    let from = block.pos + 1;
    const attrLanguage: unknown = block.node.attrs.language;
    const language = (typeof attrLanguage === "string" && attrLanguage) || defaultLanguage;
    const languages = lowlight.listLanguages();

    const nodes =
      language && (languages.includes(language) || registered(language))
        ? lowlight.highlight(language, block.node.textContent).children
        : lowlight.highlightAuto(block.node.textContent).children;

    parseNodes(nodes).forEach((node) => {
      const to = from + node.text.length;

      if (node.classes.length) {
        const decoration = Decoration.inline(from, to, {
          class: node.classes.join(" "),
        });

        decorations.push(decoration);
      }

      from = to;
    });
  });

  return DecorationSet.create(doc, decorations);
}

export function LowlightPlugin({
  name,
  lowlight,
  defaultLanguage,
}: {
  name: string;
  lowlight: Lowlight | undefined;
  defaultLanguage: string | null | undefined;
}) {
  if (!lowlight) {
    throw Error("You should provide an instance of lowlight to use the code-block-lowlight extension");
  }

  const lowlightPlugin: Plugin<DecorationSet> = new Plugin<DecorationSet>({
    key: new PluginKey("lowlight"),

    state: {
      init: (_, { doc }) =>
        getDecorations({
          doc,
          name,
          lowlight,
          defaultLanguage,
        }),
      apply: (transaction, decorationSet, oldState, newState) => {
        const oldNodeName = oldState.selection.$head.parent.type.name;
        const newNodeName = newState.selection.$head.parent.type.name;
        const oldNodes = findChildren(oldState.doc, (node) => node.type.name === name);
        const newNodes = findChildren(newState.doc, (node) => node.type.name === name);

        if (
          transaction.docChanged &&
          // Apply decorations if:
          // selection includes named node,
          ([oldNodeName, newNodeName].includes(name) ||
            // OR transaction adds/removes named node,
            newNodes.length !== oldNodes.length ||
            // OR transaction has changes that completely encapsulate a node
            // (for example, a transaction that affects the entire document).
            // Such transactions can happen during collab syncing via y-prosemirror, for example.
            transaction.steps.some((step) => {
              const from = readNumber(step, "from");
              const to = readNumber(step, "to");
              return (
                from !== undefined &&
                to !== undefined &&
                oldNodes.some((node) => node.pos >= from && node.pos + node.node.nodeSize <= to)
              );
            }))
        ) {
          return getDecorations({
            doc: transaction.doc,
            name,
            lowlight,
            defaultLanguage,
          });
        }

        return decorationSet.map(transaction.mapping, transaction.doc);
      },
    },

    props: {
      decorations(state) {
        return lowlightPlugin.getState(state);
      },
    },
  });

  return lowlightPlugin;
}
