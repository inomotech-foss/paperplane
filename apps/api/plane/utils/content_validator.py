# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import base64
import nh3
from plane.utils.exception_logger import log_exception
from collections import defaultdict
from html.parser import HTMLParser
import logging

logger = logging.getLogger("plane.api")

# Maximum allowed size for binary data (10MB)
MAX_SIZE = 10 * 1024 * 1024

# Suspicious patterns for binary data content
SUSPICIOUS_BINARY_PATTERNS = [
    "<html",
    "<!doctype",
    "<script",
    "javascript:",
    "data:",
    "<iframe",
]


def validate_binary_data(data):
    """
    Validate that binary data appears to be a valid document format
    and doesn't contain malicious content.

    Args:
        data (bytes or str): The binary data to validate, or base64-encoded string

    Returns:
        tuple: (is_valid: bool, error_message: str or None)
    """
    if not data:
        return True, None  # Empty is OK

    # Handle base64-encoded strings by decoding them first
    if isinstance(data, str):
        try:
            binary_data = base64.b64decode(data)
        except Exception:
            return False, "Invalid base64 encoding"
    else:
        binary_data = data

    # Size check - 10MB limit
    if len(binary_data) > MAX_SIZE:
        return False, "Binary data exceeds maximum size limit (10MB)"

    # Basic format validation
    if len(binary_data) < 4:
        return False, "Binary data too short to be valid document format"

    # Check for suspicious text patterns (HTML/JS)
    try:
        decoded_text = binary_data.decode("utf-8", errors="ignore")[:200]
        if any(pattern in decoded_text.lower() for pattern in SUSPICIOUS_BINARY_PATTERNS):
            return False, "Binary data contains suspicious content patterns"
    except Exception:
        pass  # Binary data might not be decodable as text, which is fine

    return True, None


# Combine custom components and editor-specific nodes into a single set of tags
CUSTOM_TAGS = {
    # editor node/tag names
    "mention-component",
    "label",
    "input",
    "image-component",
    "issue-embed-component",
    "anchor-component",
    "toc-component",
    "child-pages-component",
    "diagram-component",
    "page-attachments-component",
    "columns-component",
    "column-component",
    "embed-component",
    "math-inline-component",
    "math-block-component",
    "query-block-component",
}
ALLOWED_TAGS = nh3.ALLOWED_TAGS | CUSTOM_TAGS

# Merge nh3 defaults with all attributes used across our custom components
ATTRIBUTES = {
    "*": {
        "class",
        "id",
        "title",
        "role",
        "aria-label",
        "aria-hidden",
        "style",
        "start",
        "type",
        "xmlns",
        # common editor data-* attributes seen in stored HTML. nh3 does not
        # support wildcards, so every key the editor can emit has to be listed
        # here or it is stripped on write.
        "data-tight",
        "data-node-type",
        "data-type",
        "data-checked",
        "data-background-color",
        "data-text-color",
        "data-name",
        "data-id",
        # callout attributes
        "data-icon-name",
        "data-icon-color",
        "data-background",
        "data-emoji-unicode",
        "data-emoji-url",
        "data-logo-in-use",
        "data-block-type",
        # comment mark attributes
        "data-comment-thread-id",
        "data-comment-resolved",
    },
    "a": {"href", "target", "rel"},
    # editor node/tag attributes
    "image-component": {
        "id",
        "width",
        "height",
        "aspectRatio",
        "aspectratio",
        "src",
        "alt",
        "alignment",
        "status",
    },
    "img": {
        "width",
        "height",
        "aspectRatio",
        "aspectratio",
        "alignment",
        "src",
        "alt",
        "title",
    },
    "mention-component": {"id", "entity_identifier", "entity_name", "author"},
    "anchor-component": {"id", "name", "data-anchor"},
    "toc-component": {"min-level", "max-level"},
    "child-pages-component": {"depth"},
    "diagram-component": {"asset_id", "preview_asset_id", "width", "height", "title"},
    "columns-component": {"layout"},
    # the editor renders columns as <div class="editor-columns-component" layout="...">
    "div": {"layout"},
    "embed-component": {"url", "width", "height"},
    "math-inline-component": {"latex"},
    "math-block-component": {"latex"},
    "query-block-component": {
        "kind",
        "scope",
        "root-page-id",
        "depth",
        "limit",
        "sort",
        "reverse",
        "labels",
        "placeholder",
        "columns",
        "status",
    },
    "issue-embed-component": {
        "id",
        "entity_identifier",
        "entity_name",
        "project_identifier",
        "workspace_identifier",
    },
    "th": {
        "colspan",
        "rowspan",
        "colwidth",
        "background",
        "style",
    },
    "td": {
        "colspan",
        "rowspan",
        "colwidth",
        "background",
        "textColor",
        "textcolor",
        "style",
    },
    "tr": {"background", "textColor", "textcolor", "style"},
    "pre": {"language"},
    "code": {"language", "spellcheck"},
    "input": {"type", "checked"},
}

SAFE_PROTOCOLS = {"http", "https", "mailto", "tel"}

# The editor's own rel value, forced onto every link so editor output round-trips unchanged.
LINK_REL = "noopener noreferrer nofollow"


class _TagCollector(HTMLParser):
    """Counts tags and their attribute names without building a tree."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tag_counts = defaultdict(int)
        self.attrs_by_tag = defaultdict(set)

    def handle_starttag(self, tag, attrs):
        self.tag_counts[tag] += 1
        self.attrs_by_tag[tag].update(name for name, _value in attrs if name)


def _collect_tags(html):
    collector = _TagCollector()
    collector.feed(html or "")
    collector.close()
    return collector.tag_counts, collector.attrs_by_tag


def _compute_html_sanitization_diff(before_html: str, after_html: str):
    """
    Compute a coarse diff between original and sanitized HTML.

    Returns a dict with:
    - removed_tags: mapping[tag] -> removed_count
    - removed_attributes: mapping[tag] -> sorted list of attribute names removed
    """
    try:
        counts_before, attrs_before = _collect_tags(before_html)
        counts_after, attrs_after = _collect_tags(after_html)

        removed_tags = {}
        for tag, cnt_before in counts_before.items():
            cnt_after = counts_after.get(tag, 0)
            if cnt_after < cnt_before:
                removed = cnt_before - cnt_after
                removed_tags[tag] = removed

        removed_attributes = {}
        for tag, before_set in attrs_before.items():
            after_set = attrs_after.get(tag, set())
            removed = before_set - after_set
            if removed:
                removed_attributes[tag] = sorted(list(removed))

        return {"removed_tags": removed_tags, "removed_attributes": removed_attributes}
    except Exception:
        # Best-effort only; if diffing fails we don't block the request
        return {"removed_tags": {}, "removed_attributes": {}}


def validate_html_content(html_content: str):
    """
    Sanitize HTML content using nh3.
    Returns a tuple: (is_valid, error_message, clean_html)
    """
    if not html_content:
        return True, None, None

    # Size check - 10MB limit (consistent with binary validation)
    if len(html_content.encode("utf-8")) > MAX_SIZE:
        return False, "HTML content exceeds maximum size limit (10MB)", None

    try:
        clean_html = nh3.clean(
            html_content,
            tags=ALLOWED_TAGS,
            attributes=ATTRIBUTES,
            url_schemes=SAFE_PROTOCOLS,
            link_rel=None,
            set_tag_attribute_values={"a": {"rel": LINK_REL}},
        )
        # Report removals to logger (Sentry) if anything was stripped
        diff = _compute_html_sanitization_diff(html_content, clean_html)
        if diff.get("removed_tags") or diff.get("removed_attributes"):
            try:
                import json

                summary = json.dumps(diff)
            except Exception:
                summary = str(diff)
            logger.warning(f"HTML sanitization removals: {summary}")
        return True, None, clean_html
    except Exception as e:
        log_exception(e)
        return False, "Failed to sanitize HTML", None


def has_alphanumeric(value):
    """
    Check whether a string contains at least one alphanumeric character.

    `str.isalnum()` is Unicode-aware, so letters and digits from any script
    (Latin, CJK, Arabic, Cyrillic, etc.) all count. This mirrors the frontend
    HAS_ALPHANUMERIC_REGEX (/[\\p{L}\\p{N}]/u) check and is used to reject
    symbol-only names such as "-_________-".

    Args:
        value (str): The string to check.

    Returns:
        bool: True if the value contains at least one letter or digit.
    """
    return any(char.isalnum() for char in (value or ""))
