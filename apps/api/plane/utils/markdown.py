# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import mistune


class _NoImageRenderer(mistune.HTMLRenderer):
    """Renders images as their alt text, so untrusted Markdown cannot make readers load remote URLs."""

    def image(self, text, url, title=None):
        return text


# For untrusted Markdown such as model output: raw HTML is escaped and images become text.
untrusted_markdown = mistune.create_markdown(
    escape=True, renderer=_NoImageRenderer(escape=True), plugins=["strikethrough", "table"]
)
