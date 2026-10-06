# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models import Min

from plane.db.models import ProjectUserProperty

SORT_ORDER_STEP = 10000
DEFAULT_SORT_ORDER = 65535


def create_missing_project_user_properties(user, workspace, projects):
    """Create missing ProjectUserProperty rows, placing the new projects above existing ones by name."""
    projects = list(projects)
    existing = ProjectUserProperty.objects.filter(user=user, workspace=workspace)
    known_ids = set(existing.filter(project_id__in=[p.id for p in projects]).values_list("project_id", flat=True))
    new_projects = sorted((p for p in projects if p.id not in known_ids), key=lambda p: p.name.lower())
    if not new_projects:
        return

    lowest = existing.aggregate(lowest=Min("sort_order"))["lowest"]
    top = (lowest if lowest is not None else DEFAULT_SORT_ORDER + SORT_ORDER_STEP) - SORT_ORDER_STEP
    count = len(new_projects)
    properties = [
        ProjectUserProperty(
            project_id=project.id,
            user=user,
            workspace=workspace,
            created_by=user,
            sort_order=top - SORT_ORDER_STEP * (count - 1 - index),
        )
        for index, project in enumerate(new_projects)
    ]
    ProjectUserProperty.objects.bulk_create(properties, ignore_conflicts=True)
