/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// local imports
import { gitHubEmojis, shortcodeToEmoji } from "@tiptap/extension-emoji";
import type { MarkdownSerializerState } from "prosemirror-markdown";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Emoji } from "./emoji";
import { emojiSuggestion } from "./suggestion";

export const EmojiExtension = Emoji.extend({
  addStorage() {
    const extensionOptions = this.options;
    if (!this.parent) throw new Error("Emoji storage requires the parent extension");

    return {
      ...this.parent(),
      markdown: {
        serialize(state: MarkdownSerializerState, node: ProseMirrorNode) {
          const name: unknown = node.attrs.name;
          const shortcode = String(name);
          const emojiItem = shortcodeToEmoji(shortcode, extensionOptions.emojis);
          if (emojiItem?.emoji) {
            state.write(emojiItem?.emoji);
          } else {
            state.write(`:${shortcode}:`);
          }
        },
      },
    };
  },
}).configure({
  // Filter out emojis without emoji value and remove fallbackImage property to prevent CDN calls

  emojis: gitHubEmojis.filter((item) => item.emoji).map(({ fallbackImage, ...emoji }) => emoji),
  suggestion: emojiSuggestion,
  enableEmoticons: true,
});
