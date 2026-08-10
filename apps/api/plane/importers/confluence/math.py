# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from .parameters import macro_parameters

# The app ships both spellings of its own name, so both are accepted. The value
# is the editor tag each variant becomes.
MATH_MACROS = {
    "eazy-math-inline": "math-inline-component",
    "easy-math-inline": "math-inline-component",
    "eazy-math-block": "math-block-component",
    "easy-math-block": "math-block-component",
}


def convert_math_macro(soup, node, macro_name, result):
    """The macro stores LaTeX, which is exactly what the editor's math node
    stores, so nothing is lost. Its align parameter has no counterpart: a block
    equation is centred either way."""
    latex = macro_parameters(node).get("body", "")

    if not latex:
        result.unsupported_macros[macro_name] += 1
        node.decompose()
        return

    block = soup.new_tag(MATH_MACROS[macro_name])
    block["latex"] = latex
    node.replace_with(block)
