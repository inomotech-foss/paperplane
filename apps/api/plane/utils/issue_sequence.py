# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Helpers for the per-project work item numbering.

Work item numbers are allocated in Issue.save() as MAX(issue_sequences.sequence) + 1 for the
project, and sequence rows are kept even when a work item is deleted. Inserting a placeholder
sequence row with no work item attached is therefore enough to make the next created work item
receive a chosen number while every existing work item keeps its number.
"""

# Django imports
from django.db import connection, transaction
from django.db.models import Max
from django.utils import timezone

# Module imports
from plane.db.models import Issue, IssueSequence, Project
from plane.utils.uuid import convert_uuid_to_integer

# The smallest start that leaves room for the placeholder row at start - 1.
MIN_ISSUE_SEQUENCE_START = 2


class IssueSequenceStartError(ValueError):
    """Raised when a requested start would not move the numbering forward."""


class IssueSequenceTakenError(ValueError):
    """Raised when a work item number is already used by another work item or placeholder."""


def lock_project_issue_sequence(project_id) -> None:
    """Take the per-project advisory lock Issue.save() uses while allocating a number.

    Must be called inside a transaction; the lock is released when the transaction ends.
    """
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(%s)", [convert_uuid_to_integer(project_id)])


def get_last_issue_sequence(project: Project) -> int:
    """Return the highest work item number recorded for the project, or 0 for an empty project."""
    return IssueSequence.objects.filter(project=project).aggregate(largest=Max("sequence"))["largest"] or 0


def issue_sequence_start_error(project: Project, start: int, current: int) -> str | None:
    """Explain why `start` cannot become the next work item number, or return None when it can."""
    if start < MIN_ISSUE_SEQUENCE_START:
        return f"The start must be at least {MIN_ISSUE_SEQUENCE_START}"
    if start <= current:
        return (
            f"{project.identifier} already reaches {project.identifier}-{current}; "
            f"the start must be greater than {current}"
        )
    return None


def set_next_issue_sequence(project: Project, start: int) -> int:
    """Make the next work item created in the project receive `start`.

    Returns the previous maximum. Raises IssueSequenceStartError when `start` is not above it,
    since numbers only ever count up.
    """
    if start < MIN_ISSUE_SEQUENCE_START:
        raise IssueSequenceStartError(issue_sequence_start_error(project, start, 0))

    with transaction.atomic():
        # Serialise against concurrent work item creation so nothing can claim a number below the new start.
        lock_project_issue_sequence(project.id)

        current = get_last_issue_sequence(project)
        error = issue_sequence_start_error(project, start, current)
        if error is not None:
            raise IssueSequenceStartError(error)

        # Issue.save() assigns MAX(sequence) + 1, so a placeholder at start - 1 with no work item
        # attached makes the next created work item receive exactly `start`.
        IssueSequence.objects.create(project=project, issue=None, sequence=start - 1)

    return current


def is_issue_sequence_taken(project: Project, sequence: int, exclude_issue: Issue | None = None) -> bool:
    """Whether `sequence` is already recorded for the project.

    Numbers of deleted work items and placeholders count as taken, so a number is never reused.
    """
    rows = IssueSequence.objects.filter(project=project, sequence=sequence)
    if exclude_issue is not None:
        rows = rows.exclude(issue=exclude_issue)
    return rows.exists()


def renumber_issue(issue: Issue, sequence: int) -> int:
    """Give an existing work item the number `sequence`, e.g. turn PROJ-12 into PROJ-4711.

    Returns the previous number. Raises IssueSequenceTakenError when the number is already
    recorded for another work item, a deleted work item, or a placeholder, and ValueError when
    it is below 1. Future work items continue from the highest recorded number, so renumbering
    above the current maximum also moves the counter.
    """
    if sequence < 1:
        raise ValueError("The work item number must be at least 1")

    with transaction.atomic():
        # Serialise against concurrent work item creation and other renumbering in the project.
        lock_project_issue_sequence(issue.project_id)

        if is_issue_sequence_taken(issue.project, sequence, exclude_issue=issue):
            raise IssueSequenceTakenError(
                f"{issue.project.identifier}-{sequence} is already taken; work item numbers are never reused"
            )

        previous = issue.sequence_id
        # Bypass Issue.save(), which only allocates numbers for new rows and would touch other fields.
        Issue.objects.filter(pk=issue.pk).update(sequence_id=sequence, updated_at=timezone.now())
        if IssueSequence.objects.filter(issue=issue).update(sequence=sequence) == 0:
            IssueSequence.objects.create(project=issue.project, issue=issue, sequence=sequence)
        issue.sequence_id = sequence

    return previous
