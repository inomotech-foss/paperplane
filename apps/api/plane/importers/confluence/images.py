# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from bs4 import NavigableString

_ALIGNMENT = {"left": "left", "center": "center", "right": "right"}


def _dimension(value):
    if not value:
        return None
    value = value.strip()
    return f"{value}px" if value.isdigit() else value


def convert_images(soup, resolvers, result):
    """ac:image becomes an image-component pointing at the uploaded asset.

    Read the ri:attachment child before rewriting the parent: the old regex
    importer consumed it first, so every image lost its filename.
    """
    for node in soup.find_all("ac:image"):
        attachment_node = node.find("ri:attachment")
        url_node = node.find("ri:url")

        if url_node is not None:
            image = soup.new_tag("img")
            image["src"] = url_node.get("ri:value") or ""
            _apply_presentation(node, image)
            node.replace_with(image)
            continue

        if attachment_node is None:
            node.decompose()
            continue

        filename = attachment_node.get("ri:filename") or ""
        attachment = resolvers.attachment(filename)

        if attachment is None:
            result.unresolved_attachments.add(filename)
            node.replace_with(NavigableString(f"[{filename}]" if filename else ""))
            continue

        image = soup.new_tag("image-component")
        image["id"] = attachment.id
        image["src"] = attachment.id
        _apply_presentation(node, image)
        node.replace_with(image)


def _apply_presentation(node, image):
    width = _dimension(node.get("ac:width"))
    height = _dimension(node.get("ac:height"))
    if width:
        image["width"] = width
    if height:
        image["height"] = height

    alignment = _ALIGNMENT.get((node.get("ac:align") or "").lower())
    if alignment:
        image["alignment"] = alignment

    alt = node.get("ac:alt")
    if alt and image.name == "img":
        image["alt"] = alt
