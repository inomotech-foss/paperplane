# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

import pytest

from plane.bgtasks.webhook_task import model_activity, webhook_activity
from plane.db.models import Issue, Project, Webhook
from plane.utils.issue_type import link_starter_type

pytestmark = [pytest.mark.unit, pytest.mark.django_db]


@pytest.mark.parametrize("source", [None, "automation"])
def test_model_activity_passes_the_source_on(workspace, create_user, mocker, source):
    activity = mocker.patch("plane.bgtasks.webhook_task.webhook_activity.delay")
    extra = {} if source is None else {"source": source}

    model_activity(
        model_name="issue",
        model_id="id",
        requested_data={"priority": "high"},
        current_instance=json.dumps({"priority": "none"}),
        actor_id=str(create_user.id),
        slug=workspace.slug,
        **extra,
    )

    assert activity.call_args.kwargs["source"] == (source or "user")


def test_the_payload_activity_names_the_source(workspace, create_user, mocker):
    project = Project.objects.create(name="Hooks", identifier="HOOK", workspace=workspace, created_by=create_user)
    issue = Issue.objects.create(name="Hooked", project=project, type=link_starter_type(project))
    Webhook.objects.create(workspace=workspace, url="https://hooks.example.com/plane", issue=True)
    send = mocker.patch("plane.bgtasks.webhook_task.webhook_send_task.delay")

    webhook_activity(
        event="issue",
        verb="updated",
        field="priority",
        old_value="none",
        new_value="high",
        actor_id=str(create_user.id),
        slug=workspace.slug,
        current_site=None,
        event_id=str(issue.id),
        old_identifier=None,
        new_identifier=None,
        source="service_desk",
    )

    activity = send.call_args.kwargs["activity"]
    assert activity["source"] == "service_desk"
    assert (activity["field"], activity["old_value"], activity["new_value"]) == ("priority", "none", "high")
    assert str(activity["actor"]["id"]) == str(create_user.id)
