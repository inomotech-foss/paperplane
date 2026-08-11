# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from bs4 import NavigableString

from .embeds import EMBED_MACROS, convert_embed_macro
from .jira import convert_jira_macro
from .math import MATH_MACROS, convert_math_macro
from .parameters import macro_parameter, macro_parameters
from .placeholders import (
    PLACEHOLDER_MACROS,
    convert_onedrive_macro,
    convert_placeholder_macro,
    convert_plantuml_macro,
    convert_requirement_macro,
)
from .query_blocks import (
    convert_blog_posts_macro,
    convert_child_pages_macro,
    convert_content_by_label_macro,
    convert_content_report_macro,
    convert_contributors_macro,
    convert_details_summary_macro,
    convert_index_macro,
    convert_list_labels_macro,
    convert_live_search_macro,
    convert_page_tree_macro,
    convert_page_tree_search_macro,
    convert_recently_updated_macro,
)
from .roadmap import convert_roadmap_macro
from .tasks import task_item, task_list

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
    "decisionreport",
    "tasks-report",
    "tasks-report-macro",
}

# Listings of recently changed pages. The dashboard variant differs only in
# where Confluence rendered it.
RECENT_MACROS = {"recently-updated", "recently-updated-dashboard"}

# A create-a-page button and a version table the page history replaces: no content.
CHROME_MACROS = {"change-history", "create-from-template"}

# Macros that render one attachment, naming it in their "name" parameter.
ATTACHMENT_MACROS = {"view-file", "viewdoc", "viewpdf", "viewppt", "viewxls"}

# Every draw.io variant stores the same parameters and the same attachment pair.
DIAGRAM_MACROS = {"drawio", "drawio-sketch", "inc-drawio"}

# Macros that are a bare reference to something the link passes already resolve,
# mapped to the parameter holding it. The unnamed parameter is keyed "".
REFERENCE_MACROS = {"profile": "user", "include": "", "excerpt-include": ""}

# Matches MAX_CHILD_PAGES_DEPTH in the editor's child-pages extension.
MAX_CHILD_PAGES_DEPTH = 20

# The draw.io app stores the rendered preview next to the source, under the
# source's own name plus this suffix.
DIAGRAM_PREVIEW_SUFFIX = ".png"


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
    language = macro_parameters(node).get("language")
    if language:
        pre["language"] = language
        code["language"] = language
    code.string = body.get_text() if body is not None else ""
    pre.append(code)
    node.replace_with(pre)


def _anchor(soup, node):
    block = soup.new_tag("anchor-component")
    block["name"] = macro_parameters(node).get("", "")
    node.replace_with(block)


def _table_of_contents(soup, node):
    parameters = macro_parameters(node)
    block = soup.new_tag("toc-component")
    block["min-level"] = parameters.get("minLevel", "1")
    block["max-level"] = parameters.get("maxLevel", "6")
    node.replace_with(block)


def _child_pages(soup, node, resolvers, result):
    """The block lists the current page's descendants, so a macro rooted at
    another page becomes a query block pointed at that page instead."""
    # The page parameter holds a nested ac:link rather than text, so its
    # presence is what matters rather than its value.
    if node.find("ac:parameter", attrs={"ac:name": "page"}, recursive=False) is not None:
        convert_child_pages_macro(soup, node, resolvers, result)
        return

    parameters = macro_parameters(node)

    if parameters.get("all", "").lower() == "true":
        depth = MAX_CHILD_PAGES_DEPTH
    else:
        try:
            depth = int(parameters.get("depth") or 1)
        except ValueError:
            depth = 1

    block = soup.new_tag("child-pages-component")
    block["depth"] = str(min(max(depth, 1), MAX_CHILD_PAGES_DEPTH))
    node.replace_with(block)


def _page_attachments(soup, node):
    """The macro lists the page's own files. Its sorting and filtering
    parameters have no counterpart in the block, which shows all of them."""
    node.replace_with(soup.new_tag("page-attachments-component"))


def _attachment_macro(soup, node, macro_name, resolvers, result):
    """view-file and its format-specific siblings render one attachment. Hand
    the reference to the pass that already resolves it rather than repeating
    the lookup, so an unresolved file degrades the same way everywhere."""
    reference = node.find("ri:attachment")

    # A handful point at another page or a content id instead of a file, which
    # the page's own attachment map cannot answer.
    if reference is None:
        result.unsupported_macros[macro_name] += 1
        node.decompose()
        return

    attachment = resolvers.attachment(reference.get("ri:filename") or "")
    if attachment is not None and attachment.is_image:
        wrapper = soup.new_tag("ac:image")
        wrapper.append(reference.extract())
        node.replace_with(wrapper)
        return

    node.replace_with(reference.extract())


def _reference_macro(node, macro_name, result):
    """profile and include are a bare ri:user or ri:page wrapped in macro
    chrome. Transclusion is not reproduced; the reference is."""
    parameter = macro_parameter(node, REFERENCE_MACROS[macro_name])

    if parameter is None or parameter.find(True) is None:
        result.unsupported_macros[macro_name] += 1
        node.decompose()
        return

    # A mention is the real thing; a link instead of a transclusion is not.
    if macro_name != "profile":
        result.downgraded[macro_name] += 1

    node.replace_with(*[child.extract() for child in list(parameter.contents)])


def _diagram(soup, node, macro_name, resolvers, result):
    """The draw.io macro renders an attachment pair: the .drawio source named by
    diagramName, and its rendered preview under the same name plus .png."""
    parameters = macro_parameters(node)
    source_name = parameters.get("diagramName")

    if not source_name:
        result.unsupported_macros[macro_name] += 1
        node.decompose()
        return

    source = resolvers.attachment(source_name)
    preview_name = source_name + DIAGRAM_PREVIEW_SUFFIX
    preview = resolvers.attachment(preview_name)

    # Without either file there is no diagram to show, so fall back to the name
    # the way an unresolved image does.
    if source is None and preview is None:
        result.unresolved_attachments.add(source_name)
        node.replace_with(NavigableString(f"[{source_name}]"))
        return

    if source is None:
        result.unresolved_attachments.add(source_name)
    if preview is None:
        result.unresolved_attachments.add(preview_name)

    block = soup.new_tag("diagram-component")
    if source is not None:
        block["asset_id"] = source.id
    if preview is not None:
        block["preview_asset_id"] = preview.id
    for name in ("width", "height"):
        value = parameters.get(name)
        if value and value.isdigit():
            block[name] = value
    block["title"] = parameters.get("diagramDisplayName") or source_name
    node.replace_with(block)


def _status(soup, node):
    title = macro_parameters(node).get("title", "")
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
        elif name == "children":
            _child_pages(soup, node, resolvers, result)
        elif name == "pagetree":
            convert_page_tree_macro(soup, node, result)
        elif name == "index":
            convert_index_macro(soup, node)
        elif name in RECENT_MACROS:
            convert_recently_updated_macro(soup, node, name, result)
        elif name == "blog-posts":
            convert_blog_posts_macro(soup, node, result)
        elif name == "contributors":
            convert_contributors_macro(soup, node)
        elif name == "livesearch":
            convert_live_search_macro(soup, node)
        elif name == "pagetreesearch":
            convert_page_tree_search_macro(soup, node, resolvers)
        elif name == "contentbylabel":
            convert_content_by_label_macro(soup, node, result)
        elif name == "listlabels":
            convert_list_labels_macro(soup, node, result)
        elif name == "detailssummary":
            convert_details_summary_macro(soup, node, result)
        elif name == "content-report-table":
            convert_content_report_macro(soup, node, result)
        elif name == "attachments":
            _page_attachments(soup, node)
        elif name in DIAGRAM_MACROS:
            _diagram(soup, node, name, resolvers, result)
        elif name in ATTACHMENT_MACROS:
            _attachment_macro(soup, node, name, resolvers, result)
        elif name in REFERENCE_MACROS:
            _reference_macro(node, name, result)
        elif name == "jira":
            convert_jira_macro(soup, node, resolvers, result)
        elif name == "roadmap":
            convert_roadmap_macro(soup, node, result)
        elif name in EMBED_MACROS:
            convert_embed_macro(soup, node, name, result)
        elif name in MATH_MACROS:
            convert_math_macro(soup, node, name, result)
        elif name in PLACEHOLDER_MACROS:
            convert_placeholder_macro(soup, node, name, result)
        elif name.startswith("onedrive-connector"):
            convert_onedrive_macro(soup, node, name, result)
        elif name == "requirement-yogi":
            convert_requirement_macro(node, name, result)
        elif name == "stepashka-simple-plantuml-macro":
            convert_plantuml_macro(soup, node, name, result)
        elif name == "status":
            _status(soup, node)
        elif name in CHROME_MACROS:
            result.dropped_chrome[name] += 1
            node.decompose()
        elif name in DYNAMIC_MACROS:
            result.unsupported_macros[name] += 1
            node.decompose()
        else:
            if _rich_body(node) is None:
                result.unsupported_macros[name or "unnamed"] += 1
            _replace_with_body(soup, node)


def _decision_list(soup, node, adf_node):
    """A decision list is the editor's checkbox list with every box ticked - a
    decision that was recorded is a decision that was taken.

    The rendered fallback is a plain bullet list, so this reads the ADF node
    even though a fallback is usually present.
    """
    items = []
    for item in adf_node.find_all("ac:adf-node", attrs={"type": "decision-item"}):
        content = item.find("ac:adf-content", recursive=False)
        contents = [child.extract() for child in list(content.contents)] if content is not None else []
        if any(str(child).strip() for child in contents):
            items.append(task_item(soup, True, contents))

    # An empty list is the widget prompting for a first decision, so it holds
    # nothing to carry over.
    if not items:
        node.decompose()
        return

    node.replace_with(task_list(soup, items))


def convert_adf_extensions(soup, result):
    """ADF nodes ship a rendered HTML fallback; prefer it over guessing."""
    for node in reversed(soup.find_all("ac:adf-extension")):
        adf_node = node.find("ac:adf-node")

        if adf_node is not None and adf_node.get("type") == "decision-list":
            _decision_list(soup, node, adf_node)
            continue

        fallback = node.find("ac:adf-fallback")
        if fallback is not None:
            node.replace_with(*[child.extract() for child in list(fallback.contents)])
            continue

        # Every body, not just the first: a container node holds one per child,
        # and taking only the first drops the rest without recording anything.
        contents = node.find_all("ac:adf-content")
        if any(content.get_text().strip() for content in contents):
            node.replace_with(*[child.extract() for content in contents for child in list(content.contents)])
            continue

        # A bare extension still names the app that owned it, in an
        # extension-key attribute, which is worth keeping over a bare count.
        if adf_node is not None and adf_node.get("type") == "extension":
            attribute = adf_node.find("ac:adf-attribute", attrs={"key": "extension-key"}, recursive=False)
            key = attribute.get_text().strip() if attribute is not None else ""
            if key:
                result.downgraded["adf:extension"] += 1
                node.replace_with(NavigableString(f"[{key}]"))
                continue

        result.unsupported_macros[f"adf:{adf_node.get('type')}" if adf_node else "adf"] += 1
        node.decompose()
