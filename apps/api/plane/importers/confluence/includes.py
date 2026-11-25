# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import re

from bs4 import NavigableString

# A link to a page in this instance, as the importer writes it:
# /<workspace>/projects/<project>/pages/<page>/
_PAGE_HREF = re.compile(r"^(?:https?://[^/]+)?/[^/]+/projects/[0-9a-f-]{36}/pages/([0-9a-f-]{36})/?$")


def include_block(soup, page_id):
    """The editor's query block in its include mode: the named page's content,
    read-only and live, in place of the block."""
    block = soup.new_tag("query-block-component")
    block["kind"] = "include"
    block["root-page-id"] = str(page_id)
    return block


def _meaningful(node):
    return [child for child in node.contents if not (isinstance(child, NavigableString) and not child.strip())]


def sole_child_of_paragraph(node):
    """The paragraph ``node`` is the only content of, if there is one."""
    parent = node.parent
    if parent is not None and parent.name == "p" and _meaningful(parent) == [node]:
        return parent
    return None


def linked_page_id(anchor):
    match = _PAGE_HREF.match((anchor.get("href") or "").strip())
    return match.group(1) if match else None


def convert_include_links(soup, page_ids):
    """Turn a link to one of ``page_ids`` into an include block, where the link
    is what an imported Confluence include macro became.

    That is a link alone in its paragraph. A link in a header cell is a column
    title rather than an include, and a link among other text is a reference,
    so both stay links. Returns the ids converted, one entry per block.
    """
    wanted = {str(page_id) for page_id in page_ids}
    converted = []
    for anchor in soup.find_all("a", href=True):
        page_id = linked_page_id(anchor)
        if page_id not in wanted:
            continue
        paragraph = sole_child_of_paragraph(anchor)
        if paragraph is None or anchor.find_parent("th") is not None:
            continue
        paragraph.replace_with(include_block(soup, page_id))
        converted.append(page_id)
    return converted
