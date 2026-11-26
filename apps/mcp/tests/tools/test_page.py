"""Page edits reach the fork's v1 API in the shape it accepts.

plane-sdk's `update_project_page` sends PUT with `parent_id`; this fork serves
PATCH with `parent`. The update and version actions therefore build their own
requests, and these tests pin the method, the path and the body.
"""

from __future__ import annotations

import pytest

PAGE = "acme/projects/p/pages/pg"


def test_update_sends_only_the_fields_passed(registered, spy):
    registered["page"].fn(action="update", project_id="p", page_id="pg", description_html="<p>Revised</p>")

    call = spy.recorder.only()
    assert call.method == "pages._patch"
    assert call.kwargs == {"endpoint": PAGE, "data": {"description_html": "<p>Revised</p>"}}


def test_update_keeps_falsy_values_that_mean_something(registered, spy):
    registered["page"].fn(action="update", project_id="p", page_id="pg", access=0, is_locked=False)

    assert spy.recorder.only().kwargs["data"] == {"access": 0, "is_locked": False}


@pytest.mark.parametrize(("parent", "sent"), [("other", "other"), (None, None)], ids=["nest", "top level"])
def test_update_moves_the_page(registered, spy, parent, sent):
    registered["page"].fn(action="update", project_id="p", page_id="pg", parent=parent)

    assert spy.recorder.only().kwargs["data"] == {"parent": sent}


def test_update_with_nothing_to_change_makes_no_request(registered, spy):
    result = registered["page"].fn(action="update", project_id="p", page_id="pg")

    assert isinstance(result, str) and result.startswith("Error:")
    assert spy.recorder.calls == []


def test_listing_versions_keeps_the_page_envelope(registered, spy):
    versions = {
        "results": [{"id": "v", "last_saved_at": "2026-11-25T10:00:00Z"}],
        "total_count": 1,
        "count": 1,
        "next_cursor": "next",
        "prev_cursor": "prev",
        "next_page_results": False,
        "prev_page_results": False,
    }
    spy.returns["pages._get"] = versions

    result = registered["page"].fn(action="list_versions", project_id="p", page_id="pg", cursor="c", per_page=5)

    call = spy.recorder.only()
    assert call.kwargs == {"endpoint": f"{PAGE}/versions", "params": {"cursor": "c", "per_page": 5}}
    assert result == versions


def test_retrieving_a_version(registered, spy):
    registered["page"].fn(action="retrieve_version", project_id="p", page_id="pg", version_id="v")

    call = spy.recorder.only()
    assert call.method == "pages._get"
    assert call.kwargs == {"endpoint": f"{PAGE}/versions/v"}


# --- approvals ---------------------------------------------------------------


def test_submitting_for_review(registered, spy):
    registered["page"].fn(action="submit_for_review", project_id="p", page_id="pg", comment="Annual review")

    call = spy.recorder.only()
    assert call.method == "pages._post"
    assert call.kwargs == {"endpoint": f"{PAGE}/approval/submit", "data": {"comment": "Annual review"}}


def test_approval_status_comes_with_the_log(registered, spy):
    # the spy answers every GET alike, so one payload stands in for both responses
    answer = {"status": "approved", "results": [{"action": "approved"}]}
    spy.returns["pages._get"] = answer

    result = registered["page"].fn(action="approval_status", project_id="p", page_id="pg")

    calls = [(call.kwargs["endpoint"], call.kwargs.get("params")) for call in spy.recorder.calls]
    assert calls == [(f"{PAGE}/approval", None), (f"{PAGE}/approval/events", {"per_page": 50})]
    assert result == {"approval": answer, "events": [{"action": "approved"}]}


def test_the_register_keeps_the_page_envelope(registered, spy):
    register = {
        "results": [{"page": "pg", "status": "approved"}],
        "total_count": 1,
        "count": 1,
        "next_cursor": "next",
        "prev_cursor": "prev",
        "next_page_results": False,
        "prev_page_results": False,
    }
    spy.returns["pages._get"] = register

    result = registered["page"].fn(action="list_approvals", project_id="p", per_page=50)

    call = spy.recorder.only()
    assert call.kwargs == {"endpoint": "acme/projects/p/page-approvals", "params": {"per_page": 50}}
    assert result == register


def test_setting_a_review_date(registered, spy):
    registered["page"].fn(action="set_review_date", project_id="p", page_id="pg", next_review_date="2027-11-30")

    call = spy.recorder.only()
    assert call.method == "pages._post"
    assert call.kwargs == {
        "endpoint": f"{PAGE}/approval/review-date",
        "data": {"next_review_date": "2027-11-30", "comment": ""},
    }


def test_a_review_date_that_is_not_a_date_makes_no_request(registered, spy):
    result = registered["page"].fn(action="set_review_date", project_id="p", page_id="pg", next_review_date="soon")

    assert isinstance(result, str) and result.startswith("Error:")
    assert spy.recorder.calls == []


def test_agents_cannot_approve_or_reject(registered):
    """Decisions need a person in the app; the tool must not even offer them."""
    from plane_mcp.tools.page import ACTIONS

    names = {action.name for action in ACTIONS}
    schema = registered["page"].parameters["properties"]["action"]
    assert not names & {"approve", "reject"}
    assert not set(schema["enum"]) & {"approve", "reject"}


def test_agents_cannot_baseline_either(registered):
    """A baseline puts content in force without review; only a project admin in the app does it."""
    from plane_mcp.tools.page import ACTIONS

    forbidden = {"approve", "reject", "baseline", "baselined", "baseline_page", "mark_baseline"}
    names = {action.name for action in ACTIONS}
    schema = registered["page"].parameters["properties"]["action"]
    assert not names & forbidden
    assert not set(schema["enum"]) & forbidden
    # and no action posts to an approval endpoint other than submit and review-date
    assert {action.name for action in ACTIONS if not action.read} == {
        "create",
        "update",
        "submit_for_review",
        "set_review_date",
    }


def test_approval_status_relays_a_baseline_as_the_api_labels_it(registered, spy):
    approval = {
        "status": "baseline",
        "status_label": "Baseline (migrated, not reviewed in Paperplane)",
        "in_force_kind": "baseline",
        "approved_by": None,
        "legacy_note": "Carried over from Confluence: approved by Roger Knecht, 03.11.2025",
        "results": [{"action": "baselined", "legacy_approved_by": "Roger Knecht"}],
    }
    spy.returns["pages._get"] = approval

    result = registered["page"].fn(action="approval_status", project_id="p", page_id="pg")

    assert result["approval"]["status_label"] == "Baseline (migrated, not reviewed in Paperplane)"
    assert result["approval"]["approved_by"] is None
    assert result["events"] == [{"action": "baselined", "legacy_approved_by": "Roger Knecht"}]


def test_the_tool_explains_baselines(registered):
    description = registered["page"].description
    assert "baseline" in description
    assert "not an approval" in description


def test_page_approvals_is_a_project_feature(registered, spy):
    registered["project"].fn(action="update_features", project_id="p", page_approvals=True)

    data = spy.recorder.only().kwargs["data"]
    assert data.model_dump(exclude_none=True) == {"page_approvals": True}
