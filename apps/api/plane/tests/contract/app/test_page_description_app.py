# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

import pytest
from rest_framework import status

from plane.db.models import Page, Project, ProjectMember, ProjectPage

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture(autouse=True)
def no_tasks(mocker):
    mocker.patch("plane.app.views.page.base.page_transaction.delay")
    mocker.patch("plane.app.views.page.base.track_page_version.delay")


@pytest.fixture
def page(workspace, create_user):
    project = Project.objects.create(name="Docs", identifier="DOCS", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    page = Page.objects.create(name="Notes", workspace=workspace, owned_by=create_user, description_html="<p></p>")
    ProjectPage.objects.create(page=page, project=project, workspace=workspace)
    return page


def test_saving_keeps_the_mention_author(session_client, workspace, page, create_user):
    # The live server saves through this endpoint; the author credits page mention notifications.
    html = (
        f'<p><mention-component id="{uuid.uuid4()}" entity_identifier="{uuid.uuid4()}" '
        f'entity_name="user_mention" author="{create_user.id}"></mention-component></p>'
    )
    project_id = ProjectPage.objects.get(page=page).project_id

    response = session_client.patch(
        f"/api/workspaces/{workspace.slug}/projects/{project_id}/pages/{page.id}/description/",
        {"description_html": html},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK, response.data
    page.refresh_from_db()
    assert f'author="{create_user.id}"' in page.description_html
