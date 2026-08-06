# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from bs4 import NavigableString


def _link_text(node):
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
        label = _link_text(target) if target is not node else ""
        attachment = resolvers.attachment(filename)

        if attachment is None:
            result.unresolved_attachments.add(filename)
            target.replace_with(NavigableString(label or filename))
            continue

        target.replace_with(_new(soup, "a", {"href": attachment.url}, label or filename))


def convert_page_links(soup, resolvers, result):
    """Confluence links pages by title, so this only resolves once every page
    in the space exists."""
    for node in soup.find_all("ri:page"):
        title = node.get("ri:content-title") or ""
        space_key = node.get("ri:space-key")
        target = node.find_parent("ac:link") or node
        label = _link_text(target) if target is not node else ""
        page = resolvers.page(title, space_key)

        if page is None:
            result.unresolved_pages.add(title)
            target.replace_with(NavigableString(label or title))
            continue

        target.replace_with(_new(soup, "a", {"href": page.url}, label or page.title))


def convert_space_links(soup):
    # Spaces have no Plane equivalent.
    for node in soup.find_all("ri:space"):
        target = node.find_parent("ac:link") or node
        label = _link_text(target) if target is not node else ""
        target.replace_with(NavigableString(label or node.get("ri:space-key") or ""))


def convert_anchor_links(soup):
    for node in soup.find_all("ac:link"):
        anchor = node.get("ac:anchor")
        if not anchor:
            continue
        node.replace_with(_new(soup, "a", {"href": f"#{anchor}"}, _link_text(node) or anchor))
