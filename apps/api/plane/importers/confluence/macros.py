# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from bs4 import NavigableString

# Confluence admonitions and ADF panels, mapped to the editor's callout icon.
CALLOUT_MACROS = {
    "info": ("Info", "#3f76ff"),
    "note": ("Info", "#3f76ff"),
    "tip": ("Lightbulb", "#1fad40"),
    "success": ("CircleCheck", "#1fad40"),
    "warning": ("TriangleAlert", "#e0a800"),
    "error": ("CircleAlert", "#dc3545"),
    "panel": ("Info", "#3f76ff"),
}

# Macros whose content lives entirely in Confluence's index, so nothing can be
# carried over. Recorded on the result instead of silently vanishing.
DYNAMIC_MACROS = {
    "change-history",
    "content-report-table",
    "contentbylabel",
    "create-from-template",
    "decisionreport",
    "detailssummary",
    "livesearch",
    "pagetree",
    "recently-updated",
    "tasks-report",
    "tasks-report-macro",
}

# Dropped until the matching editor extension exists. Counted the same way as
# DYNAMIC_MACROS so the fidelity report shows exactly what a follow-up buys.
PENDING_BLOCK_MACROS = {"children", "drawio"}


def _parameters(node):
    # The anchor macro stores its name in the unnamed parameter, so an empty
    # ac:name is meaningful and kept under "".
    return {
        parameter.get("ac:name", ""): parameter.get_text().strip()
        for parameter in node.find_all("ac:parameter", recursive=False)
    }


def _rich_body(node):
    return node.find("ac:rich-text-body", recursive=False)


def _replace_with_body(soup, node, wrapper=None):
    """Keep the macro's rich-text body, drop the macro chrome."""
    body = _rich_body(node)
    target = wrapper if wrapper is not None else soup.new_tag("div")

    if body is not None:
        for child in list(body.contents):
            target.append(child.extract())

    if wrapper is None:
        node.replace_with(*target.contents) if target.contents else node.decompose()
    else:
        node.replace_with(target)


def _callout(soup, node, macro_name):
    icon_name, icon_color = CALLOUT_MACROS[macro_name]
    wrapper = soup.new_tag("div")
    wrapper["data-block-type"] = "callout-component"
    wrapper["data-logo-in-use"] = "icon"
    wrapper["data-icon-name"] = icon_name
    wrapper["data-icon-color"] = icon_color
    _replace_with_body(soup, node, wrapper)


def _code_block(soup, node):
    body = node.find("ac:plain-text-body")
    pre = soup.new_tag("pre")
    code = soup.new_tag("code")
    language = _parameters(node).get("language")
    if language:
        pre["language"] = language
        code["language"] = language
    code.string = body.get_text() if body is not None else ""
    pre.append(code)
    node.replace_with(pre)


def _anchor(soup, node):
    block = soup.new_tag("anchor-component")
    block["name"] = _parameters(node).get("", "")
    node.replace_with(block)


def _table_of_contents(soup, node):
    parameters = _parameters(node)
    block = soup.new_tag("toc-component")
    block["min-level"] = parameters.get("minLevel", "1")
    block["max-level"] = parameters.get("maxLevel", "6")
    node.replace_with(block)


def _status(soup, node):
    title = _parameters(node).get("title", "")
    node.replace_with(NavigableString(title))


def convert_structured_macros(soup, resolvers, result):
    """Innermost macros first, so a macro nested in a rich-text body is
    already converted when its parent is unwrapped."""
    for node in reversed(soup.find_all("ac:structured-macro")):
        name = (node.get("ac:name") or "").lower()

        if name == "code":
            _code_block(soup, node)
        elif name in CALLOUT_MACROS:
            _callout(soup, node, name)
        elif name == "anchor":
            _anchor(soup, node)
        elif name == "toc":
            _table_of_contents(soup, node)
        elif name == "status":
            _status(soup, node)
        elif name in PENDING_BLOCK_MACROS or name in DYNAMIC_MACROS:
            result.unsupported_macros[name] += 1
            node.decompose()
        else:
            if _rich_body(node) is None:
                result.unsupported_macros[name or "unnamed"] += 1
            _replace_with_body(soup, node)


def convert_adf_extensions(soup, result):
    """ADF nodes ship a rendered HTML fallback; prefer it over guessing."""
    for node in reversed(soup.find_all("ac:adf-extension")):
        fallback = node.find("ac:adf-fallback")
        if fallback is not None:
            node.replace_with(*[child.extract() for child in list(fallback.contents)])
            continue

        content = node.find("ac:adf-content")
        if content is not None and content.get_text().strip():
            node.replace_with(*[child.extract() for child in list(content.contents)])
            continue

        adf_node = node.find("ac:adf-node")
        result.unsupported_macros[f"adf:{adf_node.get('type')}" if adf_node else "adf"] += 1
        node.decompose()


def flatten_layouts(soup, result):
    """Multi-column layouts become sequential blocks; the editor has no
    column node."""
    for layout in soup.find_all("ac:layout"):
        if len(layout.find_all("ac:layout-cell")) > 1:
            result.dropped_layouts += 1
    for name in ("ac:layout-cell", "ac:layout-section", "ac:layout"):
        for node in soup.find_all(name):
            node.unwrap()
