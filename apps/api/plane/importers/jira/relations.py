# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from plane.db.models.issue import IssueRelationChoices

# Jira link type name -> Plane relation, and whether the relation is stored on
# the inward issue. Plane keeps only one half of each pair (there is no
# "blocking", only "blocked_by"), so "A blocks B" has to become "B blocked_by A".
LINK_TYPES = {
    "blocks": (IssueRelationChoices.BLOCKED_BY, True),
    "duplicate": (IssueRelationChoices.DUPLICATE, False),
    "relates": (IssueRelationChoices.RELATES_TO, False),
    "implements": (IssueRelationChoices.IMPLEMENTED_BY, True),
    "gantt start to start": (IssueRelationChoices.START_BEFORE, False),
    "gantt end to end": (IssueRelationChoices.FINISH_BEFORE, False),
}

# Both ends of these read the same, so either issue can hold the row.
SYMMETRIC = {IssueRelationChoices.DUPLICATE, IssueRelationChoices.RELATES_TO}

DEFAULT_RELATION = IssueRelationChoices.RELATES_TO


def resolve(issue_key, link):
    """A Jira link seen from one issue as `(from_key, to_key, type, exact)`.

    Jira writes the link on both issues, so the same pair is resolved twice and
    has to come out identical either way. A link type Plane cannot express is
    downgraded to `relates_to` rather than dropped: the connection someone made
    is worth more than the word they made it with.
    """
    name = link.type_name.strip().casefold()
    exact = name in LINK_TYPES
    relation, on_inward = LINK_TYPES.get(name, (DEFAULT_RELATION, False))

    if relation in SYMMETRIC:
        first, second = sorted((issue_key, link.other_key))
    elif link.outward == on_inward:
        first, second = link.other_key, issue_key
    else:
        first, second = issue_key, link.other_key

    return first, second, str(relation), exact
