# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from .parameters import macro_parameter, macro_parameters

# Macros that embed one external page, mapped to the parameter holding its URL.
EMBED_MACROS = {
    "miro-macro": "accessLink",
    "miro-macro-resizing": "accessLink",
    "iframe": "src",
    "widget": "url",
}

# Presentation the embed block has no counterpart for: everything else the
# iframe macro carries is chrome around the frame rather than content.
_SIZE_PARAMETERS = ("width", "height")


def _url(node, name):
    parameter = macro_parameter(node, EMBED_MACROS[name])
    if parameter is None:
        return ""

    # iframe and widget wrap the address in a link element; the Miro macros
    # store it as the parameter's own text.
    reference = parameter.find("ri:url")
    if reference is not None:
        return (reference.get("ri:value") or "").strip()
    return parameter.get_text().strip()


def convert_embed_macro(soup, node, macro_name, result):
    """The macros differ only in where they keep the URL, so one block covers
    all of them. Whether the origin may be framed is a deployment decision the
    editor makes when it renders, not something baked in at import."""
    url = _url(node, macro_name)

    if not url:
        result.unsupported_macros[macro_name] += 1
        node.decompose()
        return

    block = soup.new_tag("embed-component")
    block["url"] = url

    parameters = macro_parameters(node)
    for name in _SIZE_PARAMETERS:
        value = parameters.get(name, "").strip()
        if value:
            block[name] = value

    node.replace_with(block)
