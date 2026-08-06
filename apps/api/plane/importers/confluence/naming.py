# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import re

from plane.db.models import Project

MAX_IDENTIFIER_LENGTH = 10

_INVALID_NAME_CHARS = re.compile(Project.FORBIDDEN_NAME_CHARS_PATTERN)
_NON_ALPHANUMERIC = re.compile(r"[^A-Z0-9]")
_WHITESPACE = re.compile(r"\s+")


def _strip_invalid(value):
    return _WHITESPACE.sub(" ", _INVALID_NAME_CHARS.sub(" ", value or "")).strip()


def project_name(space_name, space_key, prefix="Wiki"):
    """A Plane-valid project name for a Confluence space.

    Falls back to the space key when the name is entirely made of characters
    the name rule rejects, so the project stays identifiable.
    """
    base = _strip_invalid(space_name) or _strip_invalid(space_key)
    candidate = f"{prefix} {base}".strip() if prefix else base
    return candidate if base and Project.is_valid_name(candidate) else f"{prefix} {space_key}".strip()


def project_identifier(space_key, taken):
    """A collision-safe identifier.

    Space keys are only unique per Confluence site and get truncated to fit,
    so a numeric suffix is added until the result is free.
    """
    base = _NON_ALPHANUMERIC.sub("", (space_key or "").upper()) or "WIKI"
    taken = {value.upper() for value in taken}

    candidate = base[:MAX_IDENTIFIER_LENGTH]
    if candidate not in taken:
        return candidate

    for suffix in range(2, 1000):
        marker = str(suffix)
        candidate = f"{base[: MAX_IDENTIFIER_LENGTH - len(marker)]}{marker}"
        if candidate not in taken:
            return candidate

    raise ValueError(f"No free project identifier for space {space_key!r}")
