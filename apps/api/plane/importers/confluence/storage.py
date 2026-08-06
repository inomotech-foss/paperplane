# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from bs4 import BeautifulSoup

from .images import convert_images
from .inline import convert_emoticons, convert_times, drop_placeholders, unwrap_inline_comment_markers
from .links import (
    convert_anchor_links,
    convert_attachment_links,
    convert_page_links,
    convert_space_links,
    convert_user_mentions,
)
from .macros import convert_adf_extensions, convert_structured_macros, flatten_layouts
from .resolvers import ConversionResult, Resolvers
from .tables import convert_tables
from .tasks import convert_task_lists

# Any ac:/ri: element still present after the passes below has no Plane
# equivalent; its text is kept and the wrapper dropped.
_RESIDUAL_PREFIXES = ("ac:", "ri:")


def storage_to_html(body, resolvers=None, result=None):
    """Convert Confluence storage-format XHTML to editor HTML.

    Pass ``result`` to accumulate fidelity findings across the two conversion
    passes a space needs (page links only resolve once every page exists).
    """
    resolvers = resolvers or Resolvers()
    result = result or ConversionResult(html="")

    soup = BeautifulSoup(body or "", "html.parser")

    drop_placeholders(soup)
    unwrap_inline_comment_markers(soup)
    convert_adf_extensions(soup, result)
    flatten_layouts(soup, result)
    convert_structured_macros(soup, resolvers, result)
    convert_task_lists(soup)
    convert_images(soup, resolvers, result)
    convert_anchor_links(soup)
    convert_user_mentions(soup, resolvers, result)
    convert_attachment_links(soup, resolvers, result)
    convert_page_links(soup, resolvers, result)
    convert_space_links(soup)
    convert_emoticons(soup)
    convert_times(soup)
    convert_tables(soup, result)
    _drop_residual_elements(soup)

    result.html = str(soup).strip() or "<p></p>"
    return result


def _drop_residual_elements(soup):
    for node in reversed(soup.find_all(True)):
        if node.name.startswith(_RESIDUAL_PREFIXES):
            node.unwrap()
        else:
            for attribute in [key for key in node.attrs if key.startswith(_RESIDUAL_PREFIXES)]:
                del node[attribute]
