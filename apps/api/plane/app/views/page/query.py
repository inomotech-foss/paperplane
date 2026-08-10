# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.fields import ArrayField
from django.db.models import Count, Exists, OuterRef, Q, Subquery, UUIDField, Value
from django.db.models.functions import Coalesce

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ROLE, WorkspaceEntityPermission
from plane.app.serializers import PageQuerySerializer
from plane.db.models import Label, Page, PageLabel, ProjectPage

# Local imports
from ..base import BaseAPIView

DEFAULT_LIMIT = 20
MAX_LIMIT = 100
# Matches MAX_CHILD_PAGES_DEPTH in the editor's child-pages extension.
MAX_TREE_DEPTH = 20

SORT_FIELDS = {"title": "name", "modified": "-updated_at", "created": "-created_at"}


def _limit(request):
    try:
        limit = int(request.GET.get("limit") or DEFAULT_LIMIT)
    except ValueError:
        return DEFAULT_LIMIT
    return max(1, min(limit, MAX_LIMIT))


def _depth(request):
    try:
        depth = int(request.GET.get("depth") or 1)
    except ValueError:
        return 1
    return max(1, min(depth, MAX_TREE_DEPTH))


def _order_by(request, default):
    field = SORT_FIELDS.get(request.GET.get("sort") or "", default)
    if request.GET.get("reverse") == "true":
        return field[1:] if field.startswith("-") else f"-{field}"
    return field


def _names(request, parameter):
    return [name.strip() for name in (request.GET.get(parameter) or "").split(",") if name.strip()]


class PageQueryEndpoint(BaseAPIView):
    """Read-only page queries backing the editor's query block.

    One endpoint for every kind, because the block is a single node whose
    ``kind`` attribute picks the query. Scoped to the workspace rather than a
    project: the Confluence macros it replaces query across spaces, so a
    project-only endpoint would be wrong for most of their uses.
    """

    permission_classes = [WorkspaceEntityPermission]
    use_read_replica = True

    def get(self, request, slug):
        kind = request.GET.get("kind") or "recent"
        handler = {
            "tree": self.tree,
            "index": self.index,
            "recent": self.recent,
            "search": self.search,
            "contributors": self.contributors,
            "by-label": self.by_label,
            "label-list": self.label_list,
        }.get(kind)
        if handler is None:
            return Response({"error": f"Unknown query kind '{kind}'"}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"results": handler(request, slug)}, status=status.HTTP_200_OK)

    def accessible_pages(self, request, slug):
        """Every page in the workspace this user may see.

        Mirrors ``PageViewSet.get_queryset`` minus its project filter. The
        membership checks stay correlated subqueries rather than joins on
        purpose: joining pages x projects x members fans the row set out and
        forces a DISTINCT over every selected column, which is what made the
        project page list melt on large wikis.
        """
        member_pages = ProjectPage.objects.filter(
            page_id=OuterRef("pk"),
            project__project_projectmember__member=request.user,
            project__project_projectmember__is_active=True,
            project__archived_at__isnull=True,
        )
        # A guest of a project that hides its features sees only their own
        # pages there, the rule PageViewSet.list applies one project at a time.
        restricted_pages = ProjectPage.objects.filter(
            page_id=OuterRef("pk"),
            project__guest_view_all_features=False,
            project__project_projectmember__member=request.user,
            project__project_projectmember__role=ROLE.GUEST.value,
            project__project_projectmember__is_active=True,
        )
        return (
            Page.objects.filter(workspace__slug=slug, archived_at__isnull=True)
            .filter(Exists(member_pages))
            .filter(Q(owned_by=request.user) | Q(access=Page.PUBLIC_ACCESS))
            .filter(Q(owned_by=request.user) | ~Q(Exists(restricted_pages)))
        )

    def scoped(self, request, queryset):
        project_id = request.GET.get("project_id")
        if request.GET.get("scope") == "project" and project_id:
            in_project = ProjectPage.objects.filter(page_id=OuterRef("pk"), project_id=project_id)
            return queryset.filter(Exists(in_project))
        return queryset

    def listed(self, queryset):
        """Annotations and deferrals the compact page shape needs.

        The description columns are megabytes per row on real wikis and the
        ArrayAgg annotations force a GROUP BY over every selected column, so
        deferring them is not an optimisation but a requirement.
        """
        label_ids = Subquery(
            PageLabel.objects.filter(page_id=OuterRef("pk"))
            .values("page_id")
            .annotate(arr=ArrayAgg("label_id", distinct=True))
            .values("arr")
        )
        project_ids = Subquery(
            ProjectPage.objects.filter(page_id=OuterRef("pk"))
            .values("page_id")
            .annotate(arr=ArrayAgg("project_id", distinct=True))
            .values("arr")
        )
        return queryset.annotate(
            label_ids=Coalesce(label_ids, Value([], output_field=ArrayField(UUIDField()))),
            project_ids=Coalesce(project_ids, Value([], output_field=ArrayField(UUIDField()))),
        ).defer("description_json", "description_html", "description_binary", "description_stripped")

    def pages(self, request, queryset, default_sort):
        queryset = self.listed(self.scoped(request, queryset)).order_by(_order_by(request, default_sort))
        return PageQuerySerializer(queryset[: _limit(request)], many=True).data

    def recent(self, request, slug):
        return self.pages(request, self.accessible_pages(request, slug), "-updated_at")

    def index(self, request, slug):
        return self.pages(request, self.accessible_pages(request, slug), "name")

    def search(self, request, slug):
        query = (request.GET.get("search") or "").strip()
        if not query:
            return []
        return self.pages(request, self.accessible_pages(request, slug).filter(name__icontains=query), "name")

    def by_label(self, request, slug):
        names = _names(request, "labels")
        if not names:
            return []
        # Labels travel by name rather than id: the macros name them, and a
        # name spans projects and survives a re-import where an id does not.
        labelled = PageLabel.objects.filter(page_id=OuterRef("pk"), label__name__in=names)
        return self.pages(request, self.accessible_pages(request, slug).filter(Exists(labelled)), "-updated_at")

    def label_list(self, request, slug):
        labels = (
            Label.objects.filter(workspace__slug=slug, page_labels__isnull=False)
            .distinct()
            .order_by("name")[: _limit(request)]
        )
        return [{"id": label.id, "name": label.name} for label in labels]

    def contributors(self, request, slug):
        rows = (
            self.scoped(request, self.accessible_pages(request, slug))
            .values("owned_by")
            .annotate(page_count=Count("id"))
            .order_by("-page_count")[: _limit(request)]
        )
        return [{"user_id": row["owned_by"], "page_count": row["page_count"]} for row in rows]

    def tree(self, request, slug):
        root_id = request.GET.get("root_page_id")
        if not root_id:
            return []
        accessible = self.listed(self.accessible_pages(request, slug))

        # One query per level, capped at MAX_TREE_DEPTH, rather than loading
        # every page in the workspace to walk it in Python.
        pages, seen, frontier = [], {str(root_id)}, [root_id]
        for _ in range(_depth(request)):
            if not frontier:
                break
            level = [
                page
                for page in accessible.filter(parent_id__in=frontier).order_by("name")
                # A parent cycle would otherwise revisit the same pages until
                # the depth cap.
                if str(page.id) not in seen
            ]
            seen.update(str(page.id) for page in level)
            pages.extend(level)
            frontier = [page.id for page in level]
        return PageQuerySerializer(pages, many=True).data
