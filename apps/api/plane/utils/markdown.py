# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import re

import mistune

_SAFE_LINK = re.compile(r"\A(?:https?:|mailto:)", re.IGNORECASE)


class _UntrustedRenderer(mistune.HTMLRenderer):
    """Images become their alt text, so readers never load a remote URL. Links with any other
    scheme become their text instead of mistune's placeholder link."""

    def image(self, text, url, title=None):
        return text

    def link(self, text, url, title=None):
        if not _SAFE_LINK.match(url.strip()):
            return text
        return super().link(text, url, title)


# For untrusted Markdown such as model output: raw HTML is escaped and images become text.
untrusted_markdown = mistune.create_markdown(
    escape=True, renderer=_UntrustedRenderer(escape=True), plugins=["strikethrough", "table"]
)
