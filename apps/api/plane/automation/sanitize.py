# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from plane.automation.registry import ActionType
from plane.utils.content_validator import validate_html_content

HTML_TEMPLATE_FIELDS = {
    ActionType.ADD_COMMENT: "comment_html",
    ActionType.CREATE_WORK_ITEM: "description_html",
}


def sanitize_html(html):
    """Returns the sanitized HTML, or None when the sanitizer rejects it."""
    if not html:
        return html
    is_valid, _error, clean = validate_html_content(html)
    return clean if is_valid else None


def template_field(action_type, config):
    """The config key holding this action's HTML template, if it has one."""
    field = HTML_TEMPLATE_FIELDS.get(action_type)
    if field and isinstance(config, dict) and isinstance(config.get(field), str):
        return field
    return None


def sanitize_action_config(action_type, config):
    """Returns the config with its HTML template sanitized, or None when the sanitizer rejects it."""
    field = template_field(action_type, config)
    if field is None:
        return config
    clean = sanitize_html(config[field])
    if clean is None:
        return None
    return {**config, field: clean}
