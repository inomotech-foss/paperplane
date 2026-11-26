# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import date

import pytest

from plane.bgtasks.page_baseline_task import baseline_pages
from plane.db.models import Page, PageApproval, PageApprovalEvent, Project, ProjectMember, ProjectPage, User
from plane.utils import page_approval

pytestmark = [pytest.mark.unit, pytest.mark.django_db]

STATUS_TABLE = (
    "<h1>Document status</h1><table><tbody>"
    "<tr><th>Status</th><td>approved</td></tr>"
    "<tr><th>Approved on</th><td>03.11.2025</td></tr>"
    "<tr><th>Approved by</th><td>Roger Knecht</td></tr></tbody></table><p>Policy text</p>"
)


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(name="ISMS", identifier="ISMS", workspace=workspace, is_page_approval_enabled=True)
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=20)
    return project


@pytest.fixture
def make_page(workspace, project, create_user):
    def make(name, **extra):
        page = Page.objects.create(
            name=name, workspace=workspace, owned_by=create_user, description_html="<p>text</p>", **extra
        )
        ProjectPage.objects.create(workspace=workspace, project=project, page=page)
        return page

    return make


def run(project, pages, actor, **kwargs):
    return baseline_pages(str(project.id), [str(page.id) for page in pages], str(actor.id), **kwargs)


def test_baselines_the_pages_with_the_actor_and_review_date(project, make_page, create_user):
    one, two = make_page("One"), make_page("Two")

    result = run(project, [one, two], create_user, next_review_date="2027-03-31", comment="Migrated")

    assert result == {"baselined": 2, "skipped": 0}
    for approval in PageApproval.objects.all():
        assert (approval.status, approval.baselined_by_id, approval.approved_by_id) == (
            "baseline",
            create_user.id,
            None,
        )
        assert approval.next_review_date == date(2027, 3, 31)
    assert set(PageApprovalEvent.objects.values_list("comment", flat=True)) == {"Migrated"}


def test_skips_pages_that_are_no_longer_eligible(project, make_page, create_user):
    submitted, locked, fine = make_page("Submitted"), make_page("Locked", is_locked=True), make_page("Fine")
    page_approval.submit(submitted, project.id, create_user)

    result = run(project, [submitted, locked, fine], create_user)

    assert result == {"baselined": 1, "skipped": 2}
    assert PageApproval.objects.get(page=submitted).status == "in_review"
    assert not PageApproval.objects.filter(page=locked).exists()


def test_a_refused_page_does_not_stop_the_run(project, make_page, create_user):
    raced, fine = make_page("A raced"), make_page("B fine")
    # submitted after the POST checked it
    page_approval.submit(raced, project.id, create_user)

    result = run(project, [raced, fine], create_user)

    assert result == {"baselined": 1, "skipped": 1}
    assert PageApproval.objects.get(page=raced).status == "in_review"
    assert PageApproval.objects.get(page=fine).status == "baseline"


def test_skips_a_page_made_private_by_someone_else(project, make_page, create_user, workspace):
    page = make_page("Policy")
    other = User.objects.create(email="owner@plane.so", username="owner")
    Page.objects.filter(pk=page.pk).update(owned_by=other, access=Page.PRIVATE_ACCESS)

    result = run(project, [page], create_user)

    assert result == {"baselined": 0, "skipped": 1}
    assert not PageApproval.objects.filter(page=page).exists()


def test_reads_the_legacy_record_from_the_page_as_baselined(project, make_page, create_user):
    page = make_page("Policy")
    # the body changed after the POST: the record comes from what is baselined
    Page.objects.filter(pk=page.pk).update(description_html=STATUS_TABLE)

    run(project, [page], create_user)

    approval = PageApproval.objects.get(page=page)
    assert (approval.legacy_status, approval.legacy_approved_by) == ("approved", "Roger Knecht")
    assert approval.baseline_version.description_html == STATUS_TABLE


def test_includes_locked_pages_when_asked(project, make_page, create_user):
    locked = make_page("Locked", is_locked=True)

    run(project, [locked], create_user, include_locked=True)

    assert PageApproval.objects.get(page=locked).status == "baseline"


def test_ignores_pages_of_other_projects(project, make_page, create_user, workspace):
    stray = Page.objects.create(name="Elsewhere", workspace=workspace, owned_by=create_user)

    result = run(project, [stray], create_user)

    assert result == {"baselined": 0, "skipped": 1}
    assert not PageApproval.objects.exists()
