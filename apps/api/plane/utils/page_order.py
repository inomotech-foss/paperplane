# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models import Max
from django.db.models.functions import Collate, Lower

from plane.db.models import Page

SORT_ORDER_STEP = 10000


class PagePlacementError(Exception):
    pass


def _project_pages(project_id):
    return Page.objects.filter(project_pages__project_id=project_id, project_pages__deleted_at__isnull=True)


def sibling_pages(project_id, parent_id):
    return _project_pages(project_id).filter(parent_id=parent_id)


def next_sort_order(project_id, parent_id):
    """A sort order that places a new page after all of its siblings."""
    highest = sibling_pages(project_id, parent_id).aggregate(highest=Max("sort_order"))["highest"]
    return SORT_ORDER_STEP if highest is None else highest + SORT_ORDER_STEP


def _ordered_siblings(project_id, parent_id, exclude_id):
    # Matches the web list: sort_order, then lower-cased name, then newest first.
    return list(
        sibling_pages(project_id, parent_id)
        .exclude(pk=exclude_id)
        .select_for_update(of=("self",))
        .order_by("sort_order", Collate(Lower("name"), "C"), "-created_at", "id")
    )


def _is_descendant(project_id, page_id, candidate_id):
    seen = set()
    current = candidate_id
    while current and current not in seen:
        if current == page_id:
            return True
        seen.add(current)
        current = _project_pages(project_id).filter(pk=current).values_list("parent_id", flat=True).first()
    return False


def place_page(page, project_id, parent_id, before_id=None, after_id=None):
    """Move a page under a parent next to a sibling, or to the end without one.

    Siblings are renumbered when there is no gap. Returns every changed page.
    Call it inside a transaction.
    """
    if before_id and after_id:
        raise PagePlacementError("Pass either before or after, not both")
    if parent_id:
        if not _project_pages(project_id).filter(pk=parent_id).exists():
            raise PagePlacementError("Parent page does not exist in the project")
        if _is_descendant(project_id, page.id, parent_id):
            raise PagePlacementError("A page cannot be moved under itself or its descendants")

    siblings = _ordered_siblings(project_id, parent_id, page.id)
    sibling_ids = [sibling.id for sibling in siblings]
    anchor_id = before_id or after_id
    if anchor_id:
        if anchor_id not in sibling_ids:
            raise PagePlacementError("The anchor page is not a sibling at the target position")
        index = sibling_ids.index(anchor_id) + (1 if after_id else 0)
    else:
        index = len(siblings)

    page.parent_id = parent_id
    if not siblings:
        page.sort_order = SORT_ORDER_STEP
    elif index == 0:
        page.sort_order = siblings[0].sort_order - SORT_ORDER_STEP
    elif index == len(siblings):
        page.sort_order = siblings[-1].sort_order + SORT_ORDER_STEP
    else:
        low, high = siblings[index - 1].sort_order, siblings[index].sort_order
        midpoint = (low + high) / 2
        if low < midpoint < high:
            page.sort_order = midpoint
        else:
            return _renumber(page, siblings, index)

    Page.objects.bulk_update([page], ["parent", "sort_order"])
    return [page]


def _renumber(page, siblings, index):
    ordered = [*siblings[:index], page, *siblings[index:]]
    changed = []
    for position, sibling in enumerate(ordered, start=1):
        sort_order = position * SORT_ORDER_STEP
        if sibling is page or sibling.sort_order != sort_order:
            sibling.sort_order = sort_order
            changed.append(sibling)
    Page.objects.bulk_update(changed, ["parent", "sort_order"])
    return changed
