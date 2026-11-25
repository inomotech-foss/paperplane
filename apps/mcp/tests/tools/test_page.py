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
