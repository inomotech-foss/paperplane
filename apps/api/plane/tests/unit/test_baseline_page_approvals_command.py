# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import date
from io import StringIO

import pytest
from django.core.management import CommandError, call_command

from plane.db.models import Page, PageApproval, PageApprovalEvent, PageVersion, Project, ProjectPage, User
from plane.utils import page_approval

STATUS_TABLE = (
    '<h1 class="auto-cursor-target">Document status</h1><table class="wrapped"><tbody>'
    '<tr><th>Status</th><td><div class="content-wrapper"><span data-background-color="green">approved</span></div></td>'
    '<td colspan="1"><span data-background-color="gray">draft</span></td></tr>'
    "<tr><th>Approved on</th><td>03.11.2025</td><td><br></td></tr>"
    "<tr><th>Approved by</th><td>Roger Knecht</td><td><br></td></tr></tbody></table><p>Policy text</p>"
)
AUTO_TABLE = STATUS_TABLE.replace(">approved<", ">AUTO<").replace("03.11.2025", "").replace("Roger Knecht", "")


@pytest.fixture
def project(workspace, create_user):
    return Project.objects.create(
        name="ISMS", identifier="ISMS", workspace=workspace, created_by=create_user, is_page_approval_enabled=True
    )


@pytest.fixture
def make_page(workspace, project, create_user):
    def make(name, html="<p>text</p>", **extra):
        page = Page.objects.create(name=name, workspace=workspace, owned_by=create_user, **extra)
        ProjectPage.objects.create(workspace=workspace, project=project, page=page)
        Page.objects.filter(pk=page.pk).update(description_html=html)
        page.refresh_from_db()
        return page

    return make


def _run(project, actor, *args):
    out, err = StringIO(), StringIO()
    call_command(
        "baseline_page_approvals", "--project", str(project.id), "--actor", actor.email, *args, stdout=out, stderr=err
    )
    return out.getvalue(), err.getvalue()


@pytest.mark.unit
@pytest.mark.django_db
class TestBaselinePageApprovals:
    def test_dry_run_reports_and_writes_nothing(self, project, make_page, create_user):
        policy = make_page("Access control policy", STATUS_TABLE)
        notes = make_page("Meeting notes")

        out, _ = _run(project, create_user, "--dry-run")

        assert (
            f"would baseline {policy.id} 'Access control policy': "
            "Carried over from Confluence: approved by Roger Knecht, 03.11.2025"
        ) in out
        assert f"would baseline {notes.id} 'Meeting notes': Baseline, no prior approval recorded" in out
        assert "DRY RUN project" in out
        assert "would baseline 2 (Confluence approval carried over 1, other Confluence status 0, " in out
        assert "nothing was written" in out
        assert not PageApproval.objects.exists()
        assert not PageApprovalEvent.objects.exists()
        assert not PageVersion.objects.exists()

    def test_baselines_each_page_with_its_legacy_record(self, project, make_page, create_user):
        policy = make_page("Access control policy", STATUS_TABLE)
        soa = make_page("Statement of Applicability", AUTO_TABLE)
        notes = make_page("Meeting notes")

        out, _ = _run(project, create_user)

        approvals = {approval.page_id: approval for approval in PageApproval.objects.all()}
        assert {approval.status for approval in approvals.values()} == {"baseline"}
        assert all(approval.approved_by_id is None and approval.revision == 0 for approval in approvals.values())
        roger = approvals[policy.id]
        assert (roger.legacy_status, roger.legacy_approved_by, roger.legacy_approved_at) == (
            "approved",
            "Roger Knecht",
            date(2025, 11, 3),
        )
        assert roger.baseline_version.description_html == STATUS_TABLE
        assert roger.baselined_by == create_user
        assert approvals[soa.id].legacy_status == "AUTO"
        assert approvals[notes.id].legacy_status == ""
        events = PageApprovalEvent.objects.filter(action="baselined")
        assert events.count() == 3
        assert {event.actor_id for event in events} == {create_user.id}
        assert events.get(page=policy).legacy_approved_by == "Roger Knecht"
        assert (
            "baselined 3 (Confluence approval carried over 1, other Confluence status 1, "
            "no prior approval recorded 1), skipped 0, failed 0"
        ) in out
        assert "Carried over from Confluence: status AUTO; not recorded as approved" in out

    def test_is_idempotent(self, project, make_page, create_user):
        make_page("Access control policy", STATUS_TABLE)
        _run(project, create_user)

        out, _ = _run(project, create_user)

        assert "baselined 0" in out
        assert "skipped 1" in out
        assert "skipped, already baselined: 1" in out
        assert PageApprovalEvent.objects.count() == 1

    def test_skips_pages_already_under_review_or_approved(self, project, make_page, create_user):
        reviewed = make_page("Reviewed")
        page_approval.submit(reviewed, project.id, create_user)
        scheduled = make_page("Scheduled")
        PageApproval.objects.create(
            page=scheduled, project=project, workspace=project.workspace, next_review_date=date(2027, 1, 1)
        )

        out, _ = _run(project, create_user)

        assert f"skip {reviewed.id} 'Reviewed': status in_review" in out
        # a review date alone keeps a draft pristine, and the date stays
        assert PageApproval.objects.get(page=scheduled).status == "baseline"
        assert PageApproval.objects.get(page=scheduled).next_review_date == date(2027, 1, 1)
        assert PageApproval.objects.get(page=reviewed).status == "in_review"

    def test_skips_locked_pages_unless_asked(self, project, make_page, create_user):
        locked = make_page("Locked", is_locked=True)

        out, _ = _run(project, create_user)

        assert f"skip {locked.id} 'Locked': locked (pass --include-locked)" in out
        assert "skipped, locked: 1" in out
        assert not PageApproval.objects.filter(page=locked).exists()

        _run(project, create_user, "--include-locked")
        assert PageApproval.objects.get(page=locked).status == "baseline"

    def test_skips_archived_pages(self, project, make_page, create_user):
        archived = make_page("Old", archived_at=date(2025, 1, 1))

        out, _ = _run(project, create_user)

        assert "skipped, archived: 1" in out
        assert not PageApproval.objects.filter(page=archived).exists()

    def test_sets_the_next_review_when_given(self, project, make_page, create_user):
        page = make_page("Policy")

        out, _ = _run(project, create_user, "--next-review", "2027-03-31")

        assert PageApproval.objects.get(page=page).next_review_date == date(2027, 3, 31)
        assert PageApprovalEvent.objects.get(page=page).next_review_date == date(2027, 3, 31)
        assert "next review of baselined pages: 2027-03-31" in out

    def test_defaults_to_no_review_date(self, project, make_page, create_user):
        page = make_page("Policy")

        _run(project, create_user)

        assert PageApproval.objects.get(page=page).next_review_date is None

    def test_limits_the_run_to_given_pages(self, project, make_page, create_user):
        one = make_page("One")
        two = make_page("Two")

        _run(project, create_user, "--page", str(one.id))

        assert PageApproval.objects.filter(page=one).exists()
        assert not PageApproval.objects.filter(page=two).exists()

    def test_refuses_pages_of_other_projects(self, project, create_user, workspace):
        stray = Page.objects.create(name="Elsewhere", workspace=workspace, owned_by=create_user)

        with pytest.raises(CommandError, match="Not pages of project"):
            _run(project, create_user, "--page", str(stray.id))

    def test_refuses_a_project_without_approvals(self, workspace, create_user):
        plain = Project.objects.create(name="Eng", identifier="ENG", workspace=workspace)

        with pytest.raises(CommandError, match="not enabled"):
            _run(plain, create_user, "--dry-run")

    def test_refuses_an_unknown_or_bot_actor(self, project, make_page):
        make_page("Policy")
        bot = User.objects.create(email="bot@plane.so", username="bot", is_bot=True)

        with pytest.raises(CommandError, match="No user"):
            call_command("baseline_page_approvals", "--project", str(project.id), "--actor", "nobody@plane.so")
        with pytest.raises(CommandError, match="not an active person"):
            _run(project, bot)

    def test_refuses_a_malformed_review_date(self, project, create_user):
        with pytest.raises(CommandError, match="YYYY-MM-DD"):
            _run(project, create_user, "--next-review", "31.03.2027")

    def test_baselined_pages_go_through_review_normally(self, project, make_page, create_user):
        page = make_page("Policy", STATUS_TABLE)
        _run(project, create_user)

        page_approval.submit(page, project.id, create_user)

        approval = PageApproval.objects.get(page=page)
        assert approval.status == "in_review"
        assert approval.in_force_kind == "baseline"
