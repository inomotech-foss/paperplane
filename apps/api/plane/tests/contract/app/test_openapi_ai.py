# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The assistant endpoints document the body they read."""

import jsonschema
import pytest

from plane.tests.openapi import documented_request


@pytest.mark.contract
@pytest.mark.parametrize(
    "route", ["/api/workspaces/{slug}/ai-assistant/", "/api/workspaces/{slug}/projects/{project_id}/ai-assistant/"]
)
def test_assistant_body(route):
    documented_request(route, "post", {"task": "Summarize", "prompt": "Some text"})
    with pytest.raises(jsonschema.ValidationError):
        documented_request(route, "post", {"prompt": "Some text"})
