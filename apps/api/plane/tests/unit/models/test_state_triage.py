# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from unittest import mock

import pytest

from plane.db.models import Project, State, StateGroup


@pytest.fixture
def project(workspace):
    return Project.objects.create(name="Triage", identifier="TRI", workspace=workspace)


@pytest.mark.unit
@pytest.mark.django_db
class TestGetOrCreateTriage:
    def test_creates_one_triage_state_and_reuses_it(self, project, create_user):
        first = State.get_or_create_triage(project, created_by_id=create_user.id)
        second = State.get_or_create_triage(project)

        assert first.pk == second.pk
        assert first.name == "Triage"
        assert first.group == StateGroup.TRIAGE.value
        assert first.created_by_id == create_user.id
        assert State.triage_objects.filter(project=project).count() == 1

    def test_regular_state_named_triage_is_left_alone(self, project):
        regular = State.objects.create(name="Triage", project=project, group=StateGroup.BACKLOG.value)

        triage_state = State.get_or_create_triage(project)

        assert triage_state.name == "Triage 2"
        assert triage_state.group == StateGroup.TRIAGE.value
        regular.refresh_from_db()
        assert regular.group == StateGroup.BACKLOG.value

    def test_returns_the_state_a_concurrent_request_created(self, project):
        rival = State.get_or_create_triage(project)
        real_filter = State.triage_objects.filter
        calls = []

        def stale_first_lookup(**kwargs):
            calls.append(kwargs)
            return State.triage_objects.none() if len(calls) == 1 else real_filter(**kwargs)

        with mock.patch.object(State.triage_objects, "filter", side_effect=stale_first_lookup):
            triage_state = State.get_or_create_triage(project)

        assert triage_state.pk == rival.pk
        assert State.triage_objects.filter(project=project).count() == 1
