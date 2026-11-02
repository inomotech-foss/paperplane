// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

export const MAX_LOCAL_Z_INDEX = 10;

// The `--z-index-*` layers in packages/tailwind-config/index.css
export const Z_INDEX_LAYERS = new Set([
  "subheader",
  "header",
  "sidebar",
  "peek",
  "rail",
  "nav",
  "modal",
  "popover",
  "toast",
  "submenu",
  "floating",
]);

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

const CSS_KEYWORDS = new Set(["auto", "inherit", "initial", "unset", "revert", "revert-layer"]);

/** Whether an inline `z-index` value bypasses the scale. Named layers are read through `var(--z-index-*)`. */
export const isOffScaleZIndexValue = (value) => {
  if (typeof value === "number") return value > MAX_LOCAL_Z_INDEX;
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (CSS_KEYWORDS.has(text)) return false;
  const layers = [...text.matchAll(/var\(--z-index-([\w-]+)\)/g)].map((match) => match[1]);
  if (layers.length > 0) return !layers.every((layer) => Z_INDEX_LAYERS.has(layer));
  return !/^-?\d+$/.test(text) || Number(text) > MAX_LOCAL_Z_INDEX;
};

const message = (token) =>
  `"${token}" is off the z-index scale. Use z-0 to z-${MAX_LOCAL_Z_INDEX} under an isolated parent, or a named layer such as z-header, z-popover or z-modal.`;

const valueMessage = (value) =>
  `z-index ${JSON.stringify(value)} is off the z-index scale. Use 0 to ${MAX_LOCAL_Z_INDEX} under an isolated parent, or a named layer such as var(--z-index-popover).`;

const isZIndexKey = (node, computed) => {
  if (!computed && node.type === "Identifier") return node.name === "zIndex";
  return node.type === "Literal" && (node.value === "zIndex" || node.value === "z-index");
};

// A literal, a negated literal or a template without expressions; anything else is not checked
const staticValue = (node) => {
  if (node.type === "Literal") return node.value;
  if (node.type === "UnaryExpression" && node.operator === "-" && node.argument.type === "Literal") {
    return typeof node.argument.value === "number" ? -node.argument.value : undefined;
  }
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return undefined;
};

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
      // { zIndex: 100 } in style props and CSS-in-JS objects
      Property(node) {
        if (!isZIndexKey(node.key, node.computed)) return;
        const value = staticValue(node.value);
        if (isOffScaleZIndexValue(value)) context.report({ node: node.value, message: valueMessage(value) });
      },
      // element.style.zIndex = "100"
      AssignmentExpression(node) {
        const { left } = node;
        if (left.type !== "MemberExpression" || !isZIndexKey(left.property, left.computed)) return;
        const value = staticValue(node.right);
        if (isOffScaleZIndexValue(value)) context.report({ node: node.right, message: valueMessage(value) });
      },
      // element.style.setProperty("z-index", "100")
      CallExpression(node) {
        const { callee, arguments: args } = node;
        if (callee.type !== "MemberExpression" || callee.computed || callee.property.name !== "setProperty") return;
        if (args.length < 2 || staticValue(args[0]) !== "z-index") return;
        const value = staticValue(args[1]);
        if (isOffScaleZIndexValue(value)) context.report({ node: args[1], message: valueMessage(value) });
      },
    };
  },
};
