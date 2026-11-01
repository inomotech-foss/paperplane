# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import mistune

# Raw HTML in the source is escaped, not passed through.
markdown = mistune.create_markdown(escape=True, plugins=["strikethrough", "table"])
