/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Parser } from "htmlparser2";

// Tags whose content is dropped together with the tag.
const NON_TEXT_TAGS = new Set(["script", "style", "textarea", "option", "xmp"]);
const MAX_IFRAME_FALLBACK_DEPTH = 5;

type THtmlVisitor = {
  onText: (text: string) => void;
  onAllowedTag: (name: string) => void;
};

/**
 * Walks HTML like a tag allowlist sanitizer: disallowed tags are dropped but keep their text,
 * except for NON_TEXT_TAGS. htmlparser2 reads iframe content as raw text, so it is parsed again.
 */
const walkHtml = (html: string, allowedTags: ReadonlySet<string>, visitor: THtmlVisitor, iframeDepth = 0) => {
  const stack: string[] = [];
  let skipDepth = 0;

  const parser = new Parser(
    {
      onopentag(name) {
        if (skipDepth > 0) {
          skipDepth++;
          return;
        }
        stack.push(name);
        if (allowedTags.has(name)) visitor.onAllowedTag(name);
        else if (NON_TEXT_TAGS.has(name)) skipDepth = 1;
      },
      ontext(text) {
        if (skipDepth > 0) return;
        const tag = stack.at(-1);
        if (tag === "iframe" && !allowedTags.has(tag) && iframeDepth < MAX_IFRAME_FALLBACK_DEPTH) {
          walkHtml(text, allowedTags, visitor, iframeDepth + 1);
        } else {
          visitor.onText(text);
        }
      },
      onclosetag(name) {
        if (skipDepth > 0) {
          skipDepth--;
          if (skipDepth > 0) return;
        }
        if (stack.at(-1) === name) stack.pop();
      },
    },
    { decodeEntities: true }
  );
  parser.write(html);
  parser.end();
};

const escapeText = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Removes all tags and returns the text content with `&`, `<` and `>` escaped.
 */
export const htmlToEscapedText = (html: string): string => {
  let result = "";
  walkHtml(html, new Set(), {
    onText: (text) => {
      result += escapeText(text);
    },
    onAllowedTag: () => {},
  });
  return result;
};

/**
 * Returns true if the HTML has no visible text and none of the allowed tags.
 */
export const hasNoHtmlContent = (html: string, allowedTags: string[] = []): boolean => {
  let isEmpty = true;
  walkHtml(html, new Set(allowedTags), {
    onText: (text) => {
      if (text.trim() !== "") isEmpty = false;
    },
    onAllowedTag: () => {
      isEmpty = false;
    },
  });
  return isEmpty;
};
