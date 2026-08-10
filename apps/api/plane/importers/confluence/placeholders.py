# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

from bs4 import NavigableString

from .parameters import macro_parameters

# Third-party widgets whose content lives outside the page. None of these will
# ever get a real editor node, but the reference survives as readable text.
PLACEHOLDER_MACROS = {
    "calendar",
    "excalidraw-narva-apps",
    "gadget",
    "jirachart",
    "jiraroadmap",
    "portfolioforjiraplan",
}


def convert_placeholder_macro(soup, node, macro_name, result):
    """Most placeholders are a bare name; a couple carry a usable plan URL."""
    url = macro_parameters(node).get("url", "")
    result.downgraded[macro_name] += 1

    if url.startswith(("http://", "https://")):
        link = soup.new_tag("a")
        link["href"] = url
        link.string = f"[{macro_name}]"
        node.replace_with(link)
        return

    node.replace_with(NavigableString(f"[{macro_name}]"))


def convert_onedrive_macro(soup, node, macro_name, result):
    """The names parameter is a JSON array of the selected file and folder
    names; the item ids alongside it carry no resolvable URL."""
    raw = macro_parameters(node).get("names", "")
    try:
        decoded = json.loads(raw)
    except ValueError:
        decoded = None

    names = [name for name in decoded if isinstance(name, str) and name] if isinstance(decoded, list) else []

    if not names:
        result.unsupported_macros[macro_name] += 1
        node.decompose()
        return

    result.downgraded[macro_name] += 1
    node.replace_with(NavigableString("[onedrive: " + ", ".join(names) + "]"))


def convert_requirement_macro(node, macro_name, result):
    """The reqKey is the content itself, so it becomes text with no
    brackets, the same way _status emits its title."""
    key = macro_parameters(node).get("reqKey", "")

    if not key:
        result.unsupported_macros[macro_name] += 1
        node.decompose()
        return

    result.downgraded[macro_name] += 1
    node.replace_with(NavigableString(key))


def convert_plantuml_macro(soup, node, macro_name, result):
    """The diagram parameter is real PlantUML source, so it becomes a code
    block rather than a placeholder."""
    source = macro_parameters(node).get("diagram", "")

    if not source:
        result.unsupported_macros[macro_name] += 1
        node.decompose()
        return

    pre = soup.new_tag("pre")
    code = soup.new_tag("code")
    pre["language"] = "plantuml"
    code["language"] = "plantuml"
    code.string = source
    pre.append(code)

    result.downgraded[macro_name] += 1
    node.replace_with(pre)
