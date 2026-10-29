# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Shared `pql` / `filters` handling for the work item list endpoints."""

from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import visible_issue_q
from plane.db.models import Issue
from plane.utils.pql import (
    WorkItemFilterError,
    apply_work_item_filters,
    compile_work_item_filters,
)


class WorkItemFilterMixin:
    """Applies the `pql` / `filters` query parameters to work item querysets."""

    def filter_work_items(self, request, slug, querysets, project_id=None):
        """Filter every queryset with the request's `pql` or `filters`.

        Returns `(querysets, error_response)`; the response is None on success.
        """
        try:
            compiled = compile_work_item_filters(request, slug, project_id=project_id)
            return [apply_work_item_filters(queryset, compiled, slug, project_id) for queryset in querysets], None
        except WorkItemFilterError as exc:
            return querysets, Response(exc.payload, status=status.HTTP_400_BAD_REQUEST)


def workspace_work_items(user, slug):
    """Work items of a workspace the user may see, with the same membership
    and guest rules as the project scoped endpoints."""
    return Issue.issue_objects.filter(
        visible_issue_q(user),
        workspace__slug=slug,
        project__archived_at__isnull=True,
    )
