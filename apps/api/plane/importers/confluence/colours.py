# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Confluence names a colour; the editor names a palette entry and resolves it
# to a light or dark value at render time. Mapping onto the palette rather than
# emitting Confluence's own hex is what keeps a highlight readable in both
# themes. The palette has no yellow, so yellow lands on orange.
_STATUS_COLOURS = {
    "grey": "gray",
    "gray": "gray",
    "red": "peach",
    "yellow": "orange",
    "green": "green",
    "blue": "light-blue",
    "purple": "purple",
}

# An uncoloured Confluence lozenge is grey.
DEFAULT_STATUS_COLOUR = "gray"


def status_colour(colour):
    return _STATUS_COLOURS.get((colour or "").strip().lower(), DEFAULT_STATUS_COLOUR)
