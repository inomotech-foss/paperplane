# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from plane.db.models import State


def merged_state_keys(state_ids):
    """Map each state id to the chart key it belongs under.

    Within one project every state keeps its own id. Across projects, states
    with the same name and group share the id of the oldest of them, so a
    chart shows one "Done" bar instead of one per project.
    """
    states = list(
        State.all_state_objects.filter(id__in={str(state_id) for state_id in state_ids if state_id})
        .order_by("created_at", "id")
        .values("id", "name", "group", "project_id")
    )
    if len({state["project_id"] for state in states}) < 2:
        return {str(state["id"]): str(state["id"]) for state in states}
    first = {}
    return {str(state["id"]): str(first.setdefault((state["name"], state["group"]), state["id"])) for state in states}
