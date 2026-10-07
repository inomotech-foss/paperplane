# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Settings patches that split the API into one OpenAPI schema per client."""

from plane.settings.openapi import SPECTACULAR_SETTINGS

_SESSION_SURFACE = {
    "ENUM_NAME_OVERRIDES": {
        **SPECTACULAR_SETTINGS["ENUM_NAME_OVERRIDES"],
        "AccessEnum": [(0, "Private"), (1, "Public")],
        "ProjectStateGroupEnum": "plane.app.serializers.state.PROJECT_STATE_GROUP_CHOICES",
        "TriageStateGroupEnum": "plane.app.serializers.state.TRIAGE_STATE_GROUP_CHOICES",
    },
    "AUTHENTICATION_WHITELIST": None,
    "SERVERS": [],
    "TAGS": [],
}

SURFACES = {
    "internal": {
        **_SESSION_SURFACE,
        "TITLE": "Plane internal API",
        "DESCRIPTION": "Session-authenticated API used by the web and space apps. Not a stable public contract.",
        "SCHEMA_PATH_PREFIX": "/api/",
        "PREPROCESSING_HOOKS": ["plane.utils.openapi.hooks.preprocess_filter_internal_paths"],
    },
    "admin": {
        **_SESSION_SURFACE,
        "TITLE": "Plane instance admin API",
        "DESCRIPTION": "Session-authenticated API used by the admin app. Not a stable public contract.",
        "SCHEMA_PATH_PREFIX": "/api/instances/",
        "PREPROCESSING_HOOKS": ["plane.utils.openapi.hooks.preprocess_filter_admin_paths"],
    },
    # The public v1 API, identical to the /api/schema/ route.
    "v1": {},
}
