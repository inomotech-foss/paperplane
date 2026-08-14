# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import colorsys
import re

# A colour may arrive as a hex, an rgb() call, or a custom property with a hex
# fallback. Any hex in the value is the value.
_HEX = re.compile(r"#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")
_RGB = re.compile(r"rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)")

# The few CSS colour names Confluence tables use.
_NAMED = {
    "black": (0, 0, 0),
    "blue": (0, 0, 255),
    "gray": (128, 128, 128),
    "green": (0, 128, 0),
    "grey": (128, 128, 128),
    "red": (255, 0, 0),
    "silver": (192, 192, 192),
    "white": (255, 255, 255),
    "whitesmoke": (245, 245, 245),
    "yellow": (255, 255, 0),
}

# Upper bound of each hue, in degrees. The palette has no yellow, so the yellows
# land on orange, and no cyan, so they land on light blue.
_HUES = ((15, "peach"), (70, "orange"), (165, "green"), (200, "light-blue"), (245, "dark-blue"), (290, "purple"))

# How far apart the channels must be, out of 255, for a colour to read as a hue
# rather than as a shade of grey. Measured on the channels rather than taken from
# HLS saturation, which climbs towards 1 near white however grey the colour is.
_GREY_CHROMA = 20

# White is what an unhighlighted cell already looks like, so it is not a
# highlight. Anything darker is.
_WHITE_LIGHTNESS = 0.98

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

# Confluence admonitions and ADF panels, mapped to the editor's callout icon.
CALLOUT_MACROS = {
    "info": ("Info", "#3f76ff"),
    "note": ("Info", "#3f76ff"),
    "tip": ("Lightbulb", "#1fad40"),
    "success": ("CircleCheck", "#1fad40"),
    "warning": ("TriangleAlert", "#e0a800"),
    "error": ("CircleAlert", "#dc3545"),
    "panel": ("Info", "#3f76ff"),
}


def status_colour(colour):
    return _STATUS_COLOURS.get((colour or "").strip().lower(), DEFAULT_STATUS_COLOUR)


def _rgb(value):
    value = (value or "").strip().lower()
    if value in _NAMED:
        return _NAMED[value]

    match = _HEX.search(value)
    if match:
        digits = match.group(1)
        if len(digits) == 3:
            digits = "".join(digit * 2 for digit in digits)
        # An alpha channel says how opaque the colour is, not which colour.
        return tuple(int(digits[at : at + 2], 16) for at in (0, 2, 4))

    match = _RGB.search(value)
    if match:
        return tuple(min(int(part), 255) for part in match.groups())
    return None


def palette_colour(value):
    """The palette entry nearest a Confluence colour, or None for no colour.

    Confluence writes an exact shade from a palette three times the size of the
    editor's, so the hue is what carries over. `transparent` and white are not
    colours a cell needs, and anything unparseable is left alone.
    """
    rgb = _rgb(value)
    if rgb is None:
        return None

    hue, lightness, _ = colorsys.rgb_to_hls(*(part / 255 for part in rgb))
    if max(rgb) - min(rgb) < _GREY_CHROMA:
        return None if lightness >= _WHITE_LIGHTNESS else "gray"

    degrees = hue * 360
    return next((key for bound, key in _HUES if degrees < bound), "pink")


def background_variable(key):
    """The editor's own way of naming a palette background, which is theme-aware
    and which the PDF export resolves back to a hex."""
    return f"var(--editor-colors-{key}-background)"
