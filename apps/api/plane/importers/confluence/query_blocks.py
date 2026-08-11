# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import re

from .parameters import macro_parameter, macro_parameters

# Matches MAX_QUERY_BLOCK_DEPTH in the editor's query-block extension.
MAX_QUERY_BLOCK_DEPTH = 20

# Confluence's sort vocabulary, mapped onto the block's. The report macros
# spell the same three orderings as "page <field>", and `detailssummary` calls
# the modification date "date".
SORT_VALUES = {
    "title": "title",
    "modified": "modified",
    "creation": "created",
    "created": "created",
    "date": "modified",
    "page title": "title",
    "page modified": "modified",
    "page created": "created",
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


def _labels_from_cql(cql):
    """Pull the label names out of a CQL clause.

    Only `label = "x"` and `label in ("x", "y")` are read. Anything else in the
    query is reported by the caller rather than guessed at, because a wrong
    filter is worse than a wide one.
    """
    match = re.search(r"label\s+in\s*\(([^)]*)\)", cql, re.IGNORECASE)
    if match:
        return [name.strip().strip("\"'") for name in match.group(1).split(",") if name.strip()]

    match = re.search(r'label\s*=\s*("[^"]*"|\'[^\']*\'|\S+)', cql, re.IGNORECASE)
    if match:
        return [match.group(1).strip("\"'")]

    return []


def _has_other_cql_clauses(cql, labels):
    """Whether the query filters on anything besides the labels we carried."""
    remainder = re.sub(r"label\s+in\s*\([^)]*\)", "", cql, flags=re.IGNORECASE)
    remainder = re.sub(r'label\s*=\s*("[^"]*"|\'[^\']*\'|\S+)', "", remainder, flags=re.IGNORECASE)
    remainder = re.sub(r"\b(and|or)\b", "", remainder, flags=re.IGNORECASE)
    return bool(remainder.strip()) if labels else bool(cql.strip())


def convert_content_by_label_macro(soup, node, result):
    """`contentbylabel` lists pages carrying a label.

    The `labels` parameter is set on most uses; the rest name their labels
    inside `cql`, which is read narrowly.
    """
    parameters = macro_parameters(node)
    cql = parameters.get("cql") or ""

    names = [name.strip() for name in (parameters.get("labels") or "").split(",") if name.strip()]
    if not names and cql:
        names = _labels_from_cql(cql)

    if not names:
        # Without a label there is nothing to query, and listing every page
        # would be a different macro.
        result.unsupported_macros["contentbylabel"] += 1
        node.decompose()
        return

    block = _block(soup, "by-label", _scope_from_spaces(parameters))
    block["labels"] = ",".join(names)

    limit = _int(parameters, "max")
    if limit:
        block["limit"] = str(limit)
    _sort(block, parameters)

    if cql and _has_other_cql_clauses(cql, names):
        result.downgraded["contentbylabel"] += 1

    node.replace_with(block)


def convert_list_labels_macro(soup, node, result):
    """`listlabels` lists the labels in use rather than the pages."""
    parameters = macro_parameters(node)
    block = _block(soup, "label-list", "workspace" if parameters.get("spaceKey") else "project")

    # The block lists every label in scope, so an exclusion list is a filter
    # the reader loses.
    if parameters.get("excludedLabels"):
        result.downgraded["listlabels"] += 1

    node.replace_with(block)


def convert_live_search_macro(soup, node):
    """`livesearch` is a search box scoped to a space.

    `size` is always `large` and `type` is always `page` across the backup, so
    neither carries anything the block does not already do.
    """
    parameters = macro_parameters(node)
    block = _block(soup, "search", "workspace" if parameters.get("spaceKey") else "project")

    placeholder = parameters.get("placeholder")
    if placeholder:
        block["placeholder"] = placeholder

    node.replace_with(block)


def convert_page_tree_search_macro(soup, node, resolvers):
    """`pagetreesearch` searches within a page's subtree.

    The one use in the backup that names a root holds it as plain text rather
    than a link, so it resolves by title like any other page reference.
    """
    parameters = macro_parameters(node)
    block = _block(soup, "search", "page")

    root = parameters.get("rootPage")
    page = resolvers.page(root) if root else None
    if page is not None:
        block["root-page-id"] = page.id

    node.replace_with(block)


def _labels_parameter(parameters):
    """The label names a macro filters on, from either the parameter or the CQL.

    Both spellings appear: `detailssummary` uses `label`, `content-report-table`
    uses `labels`, and either may name them inside `cql` instead.
    """
    for name in ("labels", "label"):
        names = [entry.strip() for entry in (parameters.get(name) or "").split(",") if entry.strip()]
        if names:
            return names
    return _labels_from_cql(parameters.get("cql") or "")


def _columns(block, parameters, name):
    """`headings` is the list of page property names to show as columns.

    `firstcolumn` only renames the page-title column, which the block always
    shows first anyway, so it carries nothing.
    """
    headings = [heading.strip() for heading in (parameters.get(name) or "").split(",") if heading.strip()]
    if headings:
        block["columns"] = ",".join(headings)


def convert_details_summary_macro(soup, node, result):
    """`detailssummary` tabulates the page properties of a set of pages.

    Every use in the backup filters on a label, so the block is only as useful
    as the label import behind it.
    """
    parameters = macro_parameters(node)
    block = _block(soup, "page-properties", _scope_from_spaces(parameters))

    names = _labels_parameter(parameters)
    if names:
        block["labels"] = ",".join(names)

    _columns(block, parameters, "headings")
    limit = _int(parameters, "pageSize")
    if limit:
        block["limit"] = str(limit)
    _sort(block, {"sort": parameters.get("sortBy"), "reverse": parameters.get("reverseSort")})

    # The macro can also show a create-a-page button and per-page like, comment
    # and label counts. None has a counterpart here, and none is content.
    if any(parameters.get(name) for name in ("createButtonLabel", "contentBlueprintId")):
        result.dropped_chrome["detailssummary"] += 1
    if any(parameters.get(name) for name in ("showLikesCount", "showCommentsCount", "showPageLabels")):
        result.downgraded["detailssummary"] += 1

    node.replace_with(block)


def convert_content_report_macro(soup, node, result):
    """`content-report-table` is the same table with a fixed column set.

    It names no headings, so the block shows the page title, who owns it and
    when it changed, which is what the macro renders.
    """
    parameters = macro_parameters(node)
    block = _block(soup, "page-properties", _scope_from_spaces(parameters))

    names = _labels_parameter(parameters)
    if names:
        block["labels"] = ",".join(names)

    limit = _int(parameters, "maxResults")
    if limit:
        block["limit"] = str(limit)
    _sort(block, parameters)

    if any(parameters.get(name) for name in ("createButtonLabel", "contentBlueprintId")):
        result.dropped_chrome["content-report-table"] += 1
    if any(parameters.get(name) for name in ("showLikesCount", "showCommentsCount")):
        result.downgraded["content-report-table"] += 1

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
