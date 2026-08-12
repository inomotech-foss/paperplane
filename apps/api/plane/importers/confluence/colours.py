# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# The editor palette resolves a light or dark value per theme, which Confluence's
# own hex cannot. It has no yellow, so yellow lands on orange.
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
