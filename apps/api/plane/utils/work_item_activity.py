# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Activity rows for work item type and custom property value changes."""

from collections import defaultdict

# Django imports
from django.utils import timezone

# Module imports
from plane.db.models import IssueActivity, IssuePropertyValue
from plane.utils.issue_property import value_to_json

VALUE_RELATIONS = ("property", "value_option", "value_user", "value_issue__project")
TYPE_FIELD = "type"
PROPERTY_FIELD = "property"


def _name(prop):
    return prop.display_name or prop.name


def type_activity(issue_id, project_id, workspace_id, actor_id, epoch, old_type, new_type):
    return IssueActivity(
        issue_id=issue_id,
        project_id=project_id,
        workspace_id=workspace_id,
        actor_id=actor_id,
        verb="updated",
        field=TYPE_FIELD,
        old_value=old_type.name if old_type else None,
        new_value=new_type.name if new_type else None,
        old_identifier=old_type.id if old_type else None,
        new_identifier=new_type.id if new_type else None,
        comment="updated the type to",
        epoch=epoch,
    )


def property_activity(row, actor_id, epoch, source, old, target=None, new=None):
    """A value of `source` changed to `new` on `target`, or was removed when `target` is None.

    `row` is any value row of the work item, for its ids.
    """
    if target is None:
        comment = f"removed the value of {_name(source)}"
    elif target.id == source.id:
        comment = f"updated {_name(source)}"
    else:
        comment = f"moved the value of {_name(source)} to {_name(target)}"
    return IssueActivity(
        issue_id=row.issue_id,
        project_id=row.project_id,
        workspace_id=row.workspace_id,
        actor_id=actor_id,
        verb="updated",
        field=PROPERTY_FIELD,
        old_value=old,
        new_value=new,
        old_identifier=source.id,
        new_identifier=target.id if target else None,
        comment=comment,
        epoch=epoch,
    )


def shown_value(rows):
    """The value rows of one property on one work item as text, None when empty."""
    shown = sorted(str(display) for row in rows if (display := value_to_json(row)[1]) not in (None, ""))
    return ", ".join(shown) or None


def value_rows(issue, property_ids):
    """The values a user set on `issue` for `property_ids`, grouped by property id."""
    grouped = defaultdict(list)
    rows = IssuePropertyValue.objects.filter(
        issue=issue, property_id__in=property_ids, is_derived=False
    ).select_related(*VALUE_RELATIONS)
    for row in rows:
        grouped[row.property_id].append(row)
    return grouped


def record_value_changes(issue, properties, before, actor_id):
    """Write an activity for each property in `properties` whose shown value differs from `before`.

    `properties` maps ids to properties and `before` is what `value_rows` returned before the change.
    """
    after = value_rows(issue, properties.keys())
    epoch = timezone.now().timestamp()
    activities = []
    for property_id, prop in properties.items():
        old_rows, new_rows = before.get(prop.id, []), after.get(prop.id, [])
        old, new = shown_value(old_rows), shown_value(new_rows)
        if old != new:
            row = (new_rows or old_rows)[0]
            activities.append(property_activity(row, actor_id, epoch, prop, old, prop, new))
    IssueActivity.objects.bulk_create(activities)
