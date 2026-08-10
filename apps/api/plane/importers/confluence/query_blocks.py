# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from .parameters import macro_parameter, macro_parameters

# Matches MAX_QUERY_BLOCK_DEPTH in the editor's query-block extension.
MAX_QUERY_BLOCK_DEPTH = 20

# Confluence's sort vocabulary, mapped onto the block's.
SORT_VALUES = {
    "title": "title",
    "modified": "modified",
    "creation": "created",
    "created": "created",
}


def _int(parameters, name, default=None):
    try:
        value = int(parameters.get(name) or "")
    except ValueError:
        return default
    return value if value > 0 else default


def _block(soup, kind, scope):
    block = soup.new_tag("query-block-component")
    block["kind"] = kind
    block["scope"] = scope
    return block


def _sort(block, parameters):
    sort = SORT_VALUES.get((parameters.get("sort") or "").lower())
    if sort:
        block["sort"] = sort
    if (parameters.get("reverse") or "").lower() == "true":
        block["reverse"] = "true"


def convert_page_tree_macro(soup, node, result):
    """`pagetree` lists a page's descendants.

    Every use in the backup leaves `root` empty, which means the page the macro
    sits on, so a set root has no measured shape to follow and is recorded
    rather than guessed at.
    """
    parameters = macro_parameters(node)
    block = _block(soup, "tree", "page")

    depth = _int(parameters, "startDepth")
    if depth:
        block["depth"] = str(min(depth, MAX_QUERY_BLOCK_DEPTH))

    # The block always lists the whole subtree, so a search box on top of it
    # is an affordance the reader loses.
    if (parameters.get("searchBox") or "").lower() == "true":
        result.downgraded["pagetree"] += 1

    node.replace_with(block)


def convert_child_pages_macro(soup, node, resolvers, result):
    """`children` carrying a `page` parameter roots the listing elsewhere.

    The parameter holds a nested `ri:page` rather than text, so the title is
    read off the link and resolved to the imported page.
    """
    parameter = macro_parameter(node, "page")
    reference = parameter.find("ri:page") if parameter else None
    title = reference.get("ri:content-title") if reference else None
    page = resolvers.page(title, reference.get("ri:space-key")) if title else None

    if page is None:
        # Without the target there is nothing to list, and pointing the block
        # at the current page would quietly show the wrong tree.
        result.unsupported_macros["children"] += 1
        if title:
            result.unresolved_pages.add(title)
        node.decompose()
        return

    parameters = macro_parameters(node)
    block = _block(soup, "tree", "workspace")
    block["root-page-id"] = page.id

    if (parameters.get("all") or "").lower() == "true":
        block["depth"] = str(MAX_QUERY_BLOCK_DEPTH)
    else:
        depth = _int(parameters, "depth")
        if depth:
            block["depth"] = str(min(depth, MAX_QUERY_BLOCK_DEPTH))

    node.replace_with(block)


def convert_index_macro(soup, node):
    """`index` is an alphabetical listing of the space, and carries no
    parameters anywhere in the backup."""
    node.replace_with(_block(soup, "index", "project"))
