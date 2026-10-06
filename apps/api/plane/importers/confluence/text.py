# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import difflib
import html
import re
import unicodedata

_BLOCK_END = re.compile(r"</(?:p|li|h[1-6]|tr|td|th|div|blockquote|pre)>|<br\s*/?>", re.I)
_TAG = re.compile(r"<[^>]+>")
_SPACE = re.compile(r"\s+")


def page_text(markup):
    """The readable lines of a page, in a form two renderings can be compared in.

    The editor rewrites markup when it saves (attributes, wrappers, emoji
    variation selectors), so markup is no basis for "did someone change this".
    Words are: tags go, entities are decoded, whitespace and Unicode
    presentation forms are normalised, and empty lines are dropped.
    """
    text = _TAG.sub("", _BLOCK_END.sub("\n", markup or ""))
    text = unicodedata.normalize("NFKC", html.unescape(text)).replace("️", "")
    lines = (_SPACE.sub(" ", line).strip() for line in text.split("\n"))
    return [line for line in lines if line]


def same_text(markup_a, markup_b):
    return page_text(markup_a) == page_text(markup_b)


def text_diff(markup_a, markup_b, label_a="a", label_b="b"):
    """A unified diff of the readable lines, plus the added/removed counts."""
    lines = list(difflib.unified_diff(page_text(markup_a), page_text(markup_b), label_a, label_b, lineterm="", n=1))
    added = sum(1 for line in lines if line.startswith("+") and not line.startswith("+++"))
    removed = sum(1 for line in lines if line.startswith("-") and not line.startswith("---"))
    return "\n".join(lines), added, removed
