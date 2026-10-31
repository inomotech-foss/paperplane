# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Check a test client response against the committed OpenAPI schema."""

import re
from functools import cache
from unittest.mock import patch
from pathlib import Path

import jsonschema
import pytest
import yaml
from django.conf import settings

SCHEMA_DIR = Path(settings.BASE_DIR).parent / "openapi"
ROUTE_PARAMETER = re.compile(r"<(?:\w+:)?(\w+)>")


def strict(node):
    """Turn an OpenAPI 3.0 schema into a JSON schema that rejects unknown keys."""
    if isinstance(node, list):
        return [strict(item) for item in node]
    if not isinstance(node, dict):
        return node
    node = {key: strict(value) for key, value in node.items()}
    if "properties" in node:
        node.setdefault("additionalProperties", False)
    if node.pop("nullable", False):
        if "type" in node:
            node["type"] = [node["type"], "null"]
        else:
            node = {"anyOf": [node, {"type": "null"}]}
    return node


@cache
def _schema(surface):
    with open(SCHEMA_DIR / f"{surface}.yaml") as f:
        return yaml.safe_load(f)


def assert_matches_schema(response, surface="internal"):
    """Validate the response body against the documented response for its route, method and status."""
    route = "/" + ROUTE_PARAMETER.sub(r"{\1}", response.wsgi_request.resolver_match.route)
    method = response.wsgi_request.method.lower()
    schema = _schema(surface)
    documented = schema["paths"][route][method]["responses"]
    assert str(response.status_code) in documented, f"{method.upper()} {route} does not document {response.status_code}"
    content = documented[str(response.status_code)].get("content", {})
    assert "application/json" in content, f"{method.upper()} {route} {response.status_code} documents no JSON body"
    body = {**content["application/json"]["schema"], "components": schema["components"]}
    jsonschema.validate(response.json(), strict(body))


def documented(response, status=200, surface="internal"):
    """Assert the status, check the body against the schema and return it."""
    assert response.status_code == status, response.content
    assert_matches_schema(response, surface)
    return response.json()


@pytest.fixture
def no_tasks():
    """Swallow Celery dispatches, the tests have no broker."""
    with patch("celery.app.task.Task.delay"), patch("celery.app.task.Task.apply_async"):
        yield
