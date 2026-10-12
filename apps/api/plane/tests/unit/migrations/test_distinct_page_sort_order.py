# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import importlib
from datetime import timedelta

import pytest
from django.db import connection
from django.utils import timezone

from plane.db.models import Page, Project, ProjectPage, User, Workspace

migration = importlib.import_module("plane.db.migrations.0151_distinct_page_sort_order")


@pytest.fixture
def project(db):
    owner = User.objects.create(username="owner", email="owner@example.com")
    workspace = Workspace.objects.create(name="ws", slug="ws", owner=owner)
    return Project.objects.create(name="Wiki", identifier="WIKI", workspace=workspace)


def make_page(project, name, sort_order=65535, parent=None, age_days=0):
    page = Page.objects.create(
        name=name,
        workspace=project.workspace,
        owned_by=project.workspace.owner,
        parent=parent,
        sort_order=sort_order,
    )
    Page.objects.filter(pk=page.pk).update(created_at=timezone.now() - timedelta(days=age_days))
    ProjectPage.objects.create(workspace=project.workspace, project=project, page=page)
    return page


def sort_orders(*pages):
    return [Page.objects.get(pk=page.pk).sort_order for page in pages]


@pytest.mark.unit
@pytest.mark.django_db
def test_renumbers_crowded_groups_in_the_displayed_order(project):
    beta = make_page(project, "beta", sort_order=5)
    alpha_old = make_page(project, "Alpha", age_days=2)
    alpha_new = make_page(project, "alpha", age_days=1)
    zulu = make_page(project, "Zulu")
    first = make_page(project, "first child", sort_order=1, parent=zulu)
    second = make_page(project, "second child", sort_order=2, parent=zulu)

    with connection.cursor() as cursor:
        cursor.execute(migration.RENUMBER_CROWDED_SIBLINGS)

    assert sort_orders(beta, alpha_new, alpha_old, zulu) == [10000, 20000, 30000, 40000]
    assert sort_orders(first, second) == [1, 2]
