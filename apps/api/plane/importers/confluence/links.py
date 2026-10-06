# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import base64
import re
from urllib.parse import urlsplit

from bs4 import NavigableString

_WIKI_URL = re.compile(r"^https?://[^/]+\.atlassian\.net/wiki/")
_WIKI_PAGE_ID = re.compile(r"/pages/(?:edit-v2/)?(\d+)|[?&]pageId=(\d+)")
_WIKI_TINY = re.compile(r"/wiki/x/([A-Za-z0-9_-]+)")


def link_text(node):
    """The label an author typed for a link, if they typed one."""
    for tag in ("ac:link-body", "ac:plain-text-link-body"):
        body = node.find(tag)
        if body is not None:
            return body.get_text().strip()
    return ""


def _new(soup, name, attrs=None, text=None):
    tag = soup.new_tag(name)
    for key, value in (attrs or {}).items():
        tag[key] = value
    if text is not None:
        tag.string = text
    return tag


def convert_user_mentions(soup, resolvers, result):
    for node in soup.find_all("ri:user"):
        account_id = node.get("ri:account-id") or node.get("ri:userkey") or ""
        user = resolvers.user(account_id)
        target = node.find_parent("ac:link") or node

        if user is None:
            result.unresolved_users.add(account_id)
            target.replace_with(NavigableString("@unknown"))
            continue

        target.replace_with(
            _new(
                soup,
                "mention-component",
                {"id": user.id, "entity_identifier": user.id, "entity_name": "user_mention"},
            )
        )


def convert_attachment_links(soup, resolvers, result):
    for node in soup.find_all("ri:attachment"):
        if node.find_parent("ac:image") is not None:
            continue

        filename = node.get("ri:filename") or ""
        target = node.find_parent("ac:link") or node
        label = link_text(target) if target is not node else ""
        attachment = resolvers.attachment(filename)

        if attachment is None:
            result.unresolved_attachments.add(filename)
            target.replace_with(NavigableString(label or filename))
            continue

        target.replace_with(_new(soup, "a", {"href": attachment.url}, label or filename))


def convert_page_links(soup, resolvers, result):
    """Confluence links pages by title, so this only resolves once every page
    in the space exists. A link may also name an anchor on that page."""
    for node in soup.find_all("ri:page"):
        title = node.get("ri:content-title") or ""
        space_key = node.get("ri:space-key")
        target = node.find_parent("ac:link") or node
        label = link_text(target) if target is not node else ""
        anchor = target.get("ac:anchor") if target is not node else None
        page = resolvers.page(title, space_key)

        if page is None:
            result.unresolved_pages.add(title)
            target.replace_with(NavigableString(label or title))
            continue

        href = f"{page.url}#{anchor}" if anchor else page.url
        target.replace_with(_new(soup, "a", {"href": href}, label or page.title))


def tiny_link_page_id(code):
    """The page id behind a `/wiki/x/<code>` short link.

    The code is the little-endian page id, base64 encoded with `/` and `+`
    swapped for `-` and `_` and the trailing padding (`=` and zero `A`s) cut.
    """
    code = code.replace("-", "/").replace("_", "+")
    code += "A" * (-len(code) % 4)
    try:
        return str(int.from_bytes(base64.b64decode(code), "little"))
    except (ValueError, TypeError):
        return None


def _wiki_url_page_id(url):
    match = _WIKI_PAGE_ID.search(url)
    if match:
        return match.group(1) or match.group(2)
    match = _WIKI_TINY.search(url)
    return tiny_link_page_id(match.group(1)) if match else None


def convert_wiki_urls(soup, resolvers, result):
    """Plain `<a>` links to Confluence pages by URL, which carry the page id.

    Authors paste these instead of using the page picker, so they are as
    common as proper page links. A URL whose page is not in the backup is
    left alone and reported: it still says where the page used to be.
    """
    for node in soup.find_all("a", href=True):
        url = node["href"]
        if not _WIKI_URL.match(url):
            continue
        page_id = _wiki_url_page_id(url)
        page = resolvers.page_by_id(page_id) if page_id else None
        if page is None:
            result.unresolved_wiki_urls.add(url)
            continue
        fragment = urlsplit(url).fragment
        node["href"] = f"{page.url}#{fragment}" if fragment else page.url
        # A pasted URL shows as itself; the page title is what a reader wants.
        if node.get_text().strip() == url.strip():
            node.string = page.title


def convert_space_links(soup):
    # Spaces have no Plane equivalent.
    for node in soup.find_all("ri:space"):
        target = node.find_parent("ac:link") or node
        label = link_text(target) if target is not node else ""
        target.replace_with(NavigableString(label or node.get("ri:space-key") or ""))


def convert_anchor_links(soup):
    """Links to an anchor on the same page. One that also names a page or an
    attachment belongs to those converters, which keep the anchor."""
    for node in soup.find_all("ac:link"):
        anchor = node.get("ac:anchor")
        if not anchor or node.find(("ri:page", "ri:attachment")) is not None:
            continue
        node.replace_with(_new(soup, "a", {"href": f"#{anchor}"}, link_text(node) or anchor))
