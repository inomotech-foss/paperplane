# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""A project's work item tree, held in memory.

Work items nest through `parent_id` and never across projects, so one query over the
project gives the whole tree. Walking it in Python keeps the traversal cycle-safe (corrupt
data can hold a parent cycle) without a recursive query per work item.
"""

# Python imports
from collections import defaultdict

# Module imports
from plane.db.models import Issue


class IssueTree:
    """Parent and child links of the live work items of one project.

    `rows` are dicts with at least `id` and `parent_id`; any further keys (dates, type)
    stay available through `node()`. A parent that is not among the rows (archived,
    deleted, a draft) is treated as absent, so its children become roots.
    """

    def __init__(self, rows):
        self._nodes = {row["id"]: row for row in rows}
        self._children = defaultdict(list)
        for row in rows:
            parent_id = row["parent_id"]
            if parent_id is not None and parent_id != row["id"] and parent_id in self._nodes:
                self._children[parent_id].append(row["id"])

    @classmethod
    def for_project(cls, project_id, fields=(), queryset=None):
        """Load the tree of a project's live work items, with `fields` on every node."""
        queryset = queryset if queryset is not None else Issue.issue_objects.filter(project_id=project_id)
        return cls(list(queryset.values("id", "parent_id", *fields)))

    def __contains__(self, issue_id):
        return issue_id in self._nodes

    def node(self, issue_id):
        return self._nodes.get(issue_id)

    def ids(self):
        return self._nodes.keys()

    def parent_id(self, issue_id):
        parent_id = self._nodes[issue_id]["parent_id"]
        return parent_id if parent_id in self._nodes and parent_id != issue_id else None

    def children(self, issue_id):
        return self._children.get(issue_id, [])

    def descendants(self, issue_id):
        """Every work item below `issue_id`, at any depth, without `issue_id` itself."""
        found = []
        seen = {issue_id}
        stack = list(self.children(issue_id))
        while stack:
            current = stack.pop()
            if current in seen:
                continue
            seen.add(current)
            found.append(current)
            stack.extend(self.children(current))
        return found

    def ancestors(self, issue_id):
        """The parent chain of `issue_id`, nearest first, stopping at a cycle."""
        found = []
        seen = {issue_id}
        current = self.parent_id(issue_id)
        while current is not None and current not in seen:
            seen.add(current)
            found.append(current)
            current = self.parent_id(current)
        return found


def date_rollup(tree, issue_id):
    """The span of dates below a work item: earliest start to latest end of its descendants.

    A descendant with only one date counts as that single day, like a bar with one date on
    the timeline. Returns None when the work item has no descendants, else a dict with
    `start_date`, `target_date` (either may be None when no descendant has a date),
    `children_count` and `descendants_count`.
    """
    descendant_ids = tree.descendants(issue_id)
    if not descendant_ids:
        return None
    starts = []
    ends = []
    for descendant_id in descendant_ids:
        node = tree.node(descendant_id)
        start, end = node.get("start_date"), node.get("target_date")
        if start is None and end is None:
            continue
        starts.append(start or end)
        ends.append(end or start)
    return {
        "start_date": min(starts) if starts else None,
        "target_date": max(ends) if ends else None,
        "children_count": len(tree.children(issue_id)),
        "descendants_count": len(descendant_ids),
    }
