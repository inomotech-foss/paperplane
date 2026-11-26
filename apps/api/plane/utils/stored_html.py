# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The stored user HTML that is sanitized at rest, and how to rewrite it in place.

A write is a queryset update filtered on the old value, so updated_at, versions, activity
and webhooks are not touched, and a row edited since it was read is left alone.
"""

from dataclasses import dataclass

from django.db.models import Model, QuerySet

from plane.automation.sanitize import HTML_TEMPLATE_FIELDS, template_field
from plane.db.models import (
    AutomationAction,
    Description,
    DescriptionVersion,
    DraftIssue,
    Issue,
    IssueComment,
    IssueDescriptionVersion,
    Page,
    PageVersion,
)
from plane.utils.html_processor import strip_tags


def _stripped(html: str, empty: str | None) -> str | None:
    return strip_tags(html) if html else empty


@dataclass(frozen=True)
class HtmlField:
    model: type[Model]
    html: str = "description_html"
    stripped: str | None = "description_stripped"
    # The value the model's save() stores as stripped text for empty HTML.
    empty_stripped: str | None = None
    # A comment mirrors its HTML into a Description row, which has to follow it.
    mirror: str | None = None

    def rows(self) -> QuerySet[Model]:
        fields = ["id", self.html] + ([self.mirror] if self.mirror else [])
        return self.model.all_objects.only(*fields).order_by("id")

    def html_of(self, row: Model) -> str | None:
        return getattr(row, self.html)

    def write(self, row: Model, clean: str) -> bool:
        """Writes one row unless it changed since it was read. Returns whether it was written."""
        values = {self.html: clean}
        if self.stripped:
            values[self.stripped] = _stripped(clean, self.empty_stripped)
        written = self.model.all_objects.filter(pk=row.pk, **{self.html: self.html_of(row)}).update(**values)
        mirror_id = getattr(row, self.mirror) if self.mirror else None
        if written and mirror_id:
            Description.all_objects.filter(pk=mirror_id).update(
                description_html=clean, description_stripped=_stripped(clean, "")
            )
        return bool(written)


class AutomationTemplate:
    """The HTML template inside an automation action's config."""

    def rows(self) -> QuerySet[Model]:
        actions = AutomationAction.all_objects.filter(action_type__in=list(HTML_TEMPLATE_FIELDS))
        return actions.only("id", "action_type", "config").order_by("id")

    def html_of(self, row: Model) -> str | None:
        config = row.config
        field = template_field(row.action_type, config)
        return config[field] if field else None

    def write(self, row: Model, clean: str) -> bool:
        config = row.config
        updated = {**config, template_field(row.action_type, config): clean}
        return bool(AutomationAction.all_objects.filter(pk=row.pk, config=config).update(config=updated))


type StoredHtml = HtmlField | AutomationTemplate

TARGETS: dict[str, StoredHtml] = {
    "page": HtmlField(Page),
    "page_version": HtmlField(PageVersion),
    "issue": HtmlField(Issue),
    "issue_description_version": HtmlField(IssueDescriptionVersion),
    "issue_comment": HtmlField(
        IssueComment, html="comment_html", stripped="comment_stripped", empty_stripped="", mirror="description_id"
    ),
    "description": HtmlField(Description),
    "description_version": HtmlField(DescriptionVersion),
    "draft_issue": HtmlField(DraftIssue),
    "automation": AutomationTemplate(),
}
