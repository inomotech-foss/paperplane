# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Shared `pql` / `filters` handling for the work item list endpoints."""

from rest_framework import status
from rest_framework.response import Response

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
            compiled = compile_work_item_filters(request, slug)
            return [apply_work_item_filters(queryset, compiled, slug, project_id) for queryset in querysets], None
        except WorkItemFilterError as exc:
            return querysets, Response(exc.payload, status=status.HTTP_400_BAD_REQUEST)


def workspace_work_items(user, slug):
    """Work items of a workspace the user may see.

    Membership is enforced the same way the project scoped endpoints enforce
    it, through the `project_projectmember` join, so a project the caller is
    not an active member of contributes nothing.
    """
    return Issue.issue_objects.filter(
        workspace__slug=slug,
        project__project_projectmember__member=user,
        project__project_projectmember__is_active=True,
        project__archived_at__isnull=True,
    )
