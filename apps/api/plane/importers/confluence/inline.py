# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import re

from bs4 import NavigableString

# Confluence sometimes stores the fallback as literal escape text, including
# UTF-16 surrogate pairs for astral-plane emoji.
_ESCAPE_SEQUENCE = re.compile(r"(?:\\u[0-9a-fA-F]{4})+")

# Older emoticons are a plain <img> pointing at a path only Confluence serves,
# so they render as a broken image anywhere else. The character is the content.
_EMOTICON_IMAGE = re.compile(r"/images/icons/emoticons/([a-z0-9_]+)\.")

_EMOTICON_CHARACTERS = {
    "add": "+",
    "block": "X",
    "check": "\N{WHITE HEAVY CHECK MARK}",
    "cheeky": "\N{FACE WITH STUCK-OUT TONGUE}",
    "error": "\N{CROSS MARK}",
    "forbidden": "\N{NO ENTRY}",
    "heart": "\N{HEAVY BLACK HEART}",
    "information": "\N{INFORMATION SOURCE}",
    "laugh": "\N{SMILING FACE WITH OPEN MOUTH AND SMILING EYES}",
    "lightbulb": "\N{ELECTRIC LIGHT BULB}",
    "lightbulb_on": "\N{ELECTRIC LIGHT BULB}",
    "minus": "-",
    "sad": "\N{SLIGHTLY FROWNING FACE}",
    "smile": "\N{SLIGHTLY SMILING FACE}",
    "thumbs_down": "\N{THUMBS DOWN SIGN}",
    "thumbs_up": "\N{THUMBS UP SIGN}",
    "warning": "\N{WARNING SIGN}",
    "wink": "\N{WINKING FACE}",
}

# Unicode has one star, so the four coloured Confluence stars all land on it.
_EMOTICON_CHARACTERS.update(
    {f"star_{colour}": "\N{WHITE MEDIUM STAR}" for colour in ("blue", "green", "red", "yellow")}
)


def decode_emoji_fallback(value):
    if not value:
        return ""
    if not _ESCAPE_SEQUENCE.fullmatch(value):
        return value
    try:
        return value.encode("utf-8").decode("unicode_escape").encode("utf-16", "surrogatepass").decode("utf-16")
    except (UnicodeDecodeError, UnicodeEncodeError):
        return ""


def convert_emoticons(soup):
    """Replace emoticons with their unicode character.

    The editor's emoji node is keyed by GitHub shortcode and not every
    Confluence shortname maps onto one; a bare character always renders.
    """
    for node in soup.find_all("ac:emoticon"):
        text = decode_emoji_fallback(node.get("ac:emoji-fallback"))
        if not text:
            shortname = node.get("ac:emoji-shortname") or ""
            name = node.get("ac:name") or ""
            text = shortname or (f":{name}:" if name else "")
        node.replace_with(NavigableString(text))

    for node in soup.find_all("img", src=_EMOTICON_IMAGE):
        name = _EMOTICON_IMAGE.search(node["src"]).group(1)
        node.replace_with(NavigableString(_EMOTICON_CHARACTERS.get(name, f":{name}:")))


def convert_times(soup):
    for node in soup.find_all("time"):
        node.replace_with(NavigableString(node.get("datetime") or ""))


def drop_placeholders(soup):
    """Template hint text, shown greyed out in Confluence and never content.

    Takes the surrounding paragraph with it when the placeholder was all it
    held, rather than leaving a blank line behind.
    """
    for node in soup.find_all("ac:placeholder"):
        parent = node.parent
        node.decompose()
        if parent is not None and parent.name == "p" and not parent.get_text().strip() and not parent.find(True):
            parent.decompose()


def unwrap_inline_comment_markers(soup):
    # The comments themselves are not in the backup, so a surviving marker
    # would point at nothing.
    for node in soup.find_all("ac:inline-comment-marker"):
        node.unwrap()
