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


def _scope_from_spaces(parameters):
    """A `spaces` parameter widens the query past the space it sits in. The
    block has no per-space filter, so the nearest faithful reading is the whole
    workspace, which is where the other imported spaces are."""
    return "workspace" if parameters.get("spaces") else "project"


def convert_recently_updated_macro(soup, node, macro_name, result):
    """`recently-updated` and its dashboard variant list recently changed pages."""
    parameters = macro_parameters(node)
    block = _block(soup, "recent", _scope_from_spaces(parameters))

    limit = _int(parameters, "max")
    if limit:
        block["limit"] = str(limit)

    # The macro can also list comments and blog posts, neither of which Plane
    # has, so a mixed listing comes back as pages alone.
    types = (parameters.get("types") or "").lower()
    if types and types != "page":
        result.downgraded[macro_name] += 1

    node.replace_with(block)


def convert_blog_posts_macro(soup, node, result):
    """Plane has no blog posts, so the listing falls back to pages."""
    parameters = macro_parameters(node)
    block = _block(soup, "recent", _scope_from_spaces(parameters))

    limit = _int(parameters, "max")
    if limit:
        block["limit"] = str(limit)

    # `content=excerpts` renders a summary under each entry, which the block
    # has no counterpart for; titles alone survive.
    if (parameters.get("content") or "").lower() == "excerpts":
        result.downgraded["blog-posts"] += 1

    node.replace_with(block)


def convert_contributors_macro(soup, node):
    """`contributors` counts who authored the pages below this one. `scope` is
    `descendants` in every use in the backup."""
    parameters = macro_parameters(node)
    block = _block(soup, "contributors", "page")

    limit = _int(parameters, "limit")
    if limit:
        block["limit"] = str(limit)

    node.replace_with(block)
