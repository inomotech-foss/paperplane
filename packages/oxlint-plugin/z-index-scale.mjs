// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

export const MAX_LOCAL_Z_INDEX = 10;

// Arbitrary values may be cut off by a template expression, as in `z-[${value}]`
const Z_CLASS = /^-?z-(\[[^\]]*\]?|\([^)]*\)?|\d+)$/;
const Z_PROPERTY = /^!?\[z-index:/;

/** Returns the z-index classes in a class string that bypass the scale. */
export const findOffScaleZIndexClasses = (text) =>
  text.split(/\s+/).filter((token) => {
    if (Z_PROPERTY.test(token.replace(/^(?:[^[:\s]+:)*/, ""))) return true;
    const utility = token.split(":").at(-1)?.replace(/^!|!$/g, "") ?? "";
    const match = Z_CLASS.exec(utility);
    if (!match) return false;
    return !/^\d+$/.test(match[1]) || Number(match[1]) > MAX_LOCAL_Z_INDEX;
  });

const message = (token) =>
  `"${token}" is off the z-index scale. Use z-0 to z-${MAX_LOCAL_Z_INDEX} under an isolated parent, or a named layer such as z-header, z-popover or z-modal.`;

export const zIndexScale = {
  meta: {
    type: "problem",
    docs: { description: "Keep z-index classes on the shared scale" },
  },
  create(context) {
    const check = (node, text) => {
      for (const token of findOffScaleZIndexClasses(text)) context.report({ node, message: message(token) });
    };
    return {
      Literal(node) {
        if (typeof node.value === "string") check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.raw);
      },
    };
  },
};
