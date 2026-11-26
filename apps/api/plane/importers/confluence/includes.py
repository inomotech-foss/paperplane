# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from bs4 import NavigableString


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
