# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from plane.db.models.state import StateGroup

# Jira's four workflow buckets, keyed on the `statusCategory` key and on the
# display name the same field carries. Status names run to the dozens per site
# and are renamed freely; the category is the part every Jira agrees on.
CATEGORY_GROUPS = {
    "undefined": StateGroup.BACKLOG.value,
    "no category": StateGroup.BACKLOG.value,
    "new": StateGroup.UNSTARTED.value,
    "to do": StateGroup.UNSTARTED.value,
    "indeterminate": StateGroup.STARTED.value,
    "in progress": StateGroup.STARTED.value,
    "done": StateGroup.COMPLETED.value,
}

# Resolutions that close an issue without the work having been delivered.
CANCELLING_RESOLUTIONS = {
    "abandoned",
    "cannot reproduce",
    "cant reproduce",
    "can't reproduce",
    "declined",
    "duplicate",
    "incomplete",
    "not a bug",
    "obsolete",
    "out of scope",
    "rejected",
    "won't do",
    "won't fix",
    "wont do",
    "wont fix",
}

# Statuses whose own name already says the work was dropped.
CANCELLED_STATUSES = {"abandoned", "cancelled", "canceled", "declined", "rejected", "won't do", "wont do"}

# Where issues closed by a cancelling resolution go. Their Jira status is
# shared with issues that really were delivered, so it cannot carry the group.
CANCELLED_STATE = "Cancelled"

DEFAULT_STATE = "Backlog"

GROUP_COLOURS = {
    StateGroup.BACKLOG.value: "#60646C",
    StateGroup.UNSTARTED.value: "#60646C",
    StateGroup.STARTED.value: "#F59E0B",
    StateGroup.COMPLETED.value: "#46A758",
    StateGroup.CANCELLED.value: "#9AA4BC",
}

# Creation order, which is also the order states get their sequence in.
GROUP_ORDER = (
    StateGroup.BACKLOG.value,
    StateGroup.UNSTARTED.value,
    StateGroup.STARTED.value,
    StateGroup.COMPLETED.value,
    StateGroup.CANCELLED.value,
)


def state_group(category):
    return CATEGORY_GROUPS.get((category or "").strip().casefold(), StateGroup.BACKLOG.value)


def state_for(issue):
    """The state name and group an issue lands in.

    `statusCategory` cannot tell a delivered issue from a dropped one: "Fixed"
    and "Won't Do" both sit under Done, and only the resolution says which
    happened.
    """
    group = state_group(issue.status_category)
    name = (issue.status or "").strip() or DEFAULT_STATE
    if group != StateGroup.COMPLETED.value:
        return name, group
    if name.casefold() in CANCELLED_STATUSES:
        return name, StateGroup.CANCELLED.value
    if (issue.resolution or "").strip().casefold() in CANCELLING_RESOLUTIONS:
        return CANCELLED_STATE, StateGroup.CANCELLED.value
    return name, StateGroup.COMPLETED.value


def in_workflow_order(statuses):
    """State names ordered so a project reads backlog first and cancelled last."""
    return sorted(statuses.items(), key=lambda item: (GROUP_ORDER.index(item[1]), item[0]))
