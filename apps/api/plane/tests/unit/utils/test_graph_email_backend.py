# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import base64
import email
from unittest.mock import MagicMock, patch

import pytest
from django.core.mail import EmailMultiAlternatives

from plane.utils import ms365_graph
from plane.utils.email.graph_backend import GraphEmailBackend
from plane.utils.ms365_graph import MAX_REQUEST_SIZE, MSGraphError


def _response(status_code=200, json_data=None, text=""):
    response = MagicMock()
    response.status_code = status_code
    response.ok = 200 <= status_code < 300
    response.json.return_value = json_data or {}
    response.text = text
    return response


@pytest.fixture(autouse=True)
def clear_token_cache():
    ms365_graph._token_cache.clear()
    yield
    ms365_graph._token_cache.clear()


@pytest.fixture
def graph():
    with (
        patch("plane.utils.ms365_graph.requests.post") as token_post,
        patch("plane.utils.ms365_graph.requests.request") as graph_request,
    ):
        token_post.return_value = _response(json_data={"access_token": "tok", "expires_in": 3600})
        graph_request.return_value = _response(status_code=202)
        yield token_post, graph_request


def _backend(**kwargs):
    return GraphEmailBackend(
        tenant_id="tenant",
        client_id="client",
        client_secret="secret",
        sender="noreply@example.com",
        **kwargs,
    )


def _message(**kwargs):
    msg = EmailMultiAlternatives(
        subject="Hello",
        body="plain body",
        from_email="Plane <noreply@example.com>",
        to=["user@example.com"],
        **kwargs,
    )
    msg.attach_alternative("<p>html body</p>", "text/html")
    return msg


def _sent_mime(graph_request, call=0):
    kwargs = graph_request.call_args_list[call].kwargs
    return email.message_from_bytes(base64.b64decode(kwargs["data"]))


@pytest.mark.unit
class TestGraphEmailBackend:
    def test_posts_base64_mime_to_sender_mailbox(self, graph):
        token_post, graph_request = graph

        assert _backend().send_messages([_message()]) == 1

        args, kwargs = graph_request.call_args
        assert args == ("POST", "https://graph.microsoft.com/v1.0/users/noreply@example.com/sendMail")
        assert kwargs["headers"]["Content-Type"] == "text/plain"
        assert kwargs["headers"]["Authorization"] == "Bearer tok"
        assert kwargs["timeout"] == 30

        mime = _sent_mime(graph_request)
        assert mime["Subject"] == "Hello"
        assert mime["To"] == "user@example.com"
        assert mime.get_content_type() == "multipart/alternative"
        parts = [part.get_content_type() for part in mime.walk()]
        assert "text/plain" in parts
        assert "text/html" in parts

    def test_keeps_attachments_and_bcc(self, graph):
        _, graph_request = graph
        msg = _message(bcc=["hidden@example.com"])
        msg.attach("report.csv", "a,b\n1,2\n", "text/csv")

        _backend().send_messages([msg])

        mime = _sent_mime(graph_request)
        assert mime["Bcc"] == "hidden@example.com"
        filenames = [part.get_filename() for part in mime.walk() if part.get_filename()]
        assert filenames == ["report.csv"]

    def test_falls_back_to_from_address_without_sender(self, graph):
        _, graph_request = graph
        backend = GraphEmailBackend(tenant_id="t", client_id="c", client_secret="s")

        backend.send_messages([_message()])

        assert graph_request.call_args.args[1].endswith("/users/noreply@example.com/sendMail")

    def test_reuses_token_across_messages_and_connections(self, graph):
        token_post, graph_request = graph

        _backend().send_messages([_message(), _message()])
        _backend().send_messages([_message()])

        assert token_post.call_count == 1
        assert graph_request.call_count == 3

    def test_refreshes_expired_token(self, graph):
        token_post, _ = graph
        token_post.return_value = _response(json_data={"access_token": "tok", "expires_in": 0})

        _backend().send_messages([_message(), _message()])

        assert token_post.call_count == 2

    def test_drops_token_after_unauthorized(self, graph):
        token_post, graph_request = graph
        graph_request.return_value = _response(status_code=401, text="expired")

        with pytest.raises(MSGraphError):
            _backend().send_messages([_message()])
        graph_request.return_value = _response(status_code=202)
        _backend().send_messages([_message()])

        assert token_post.call_count == 2

    def test_skips_messages_without_recipients(self, graph):
        _, graph_request = graph
        msg = _message()
        msg.to = []

        assert _backend().send_messages([msg]) == 0
        graph_request.assert_not_called()

    def test_raises_graph_errors(self, graph):
        _, graph_request = graph
        graph_request.return_value = _response(status_code=403, text="ErrorAccessDenied")

        with pytest.raises(MSGraphError, match="403"):
            _backend().send_messages([_message()])

    def test_fail_silently_counts_only_sent_messages(self, graph):
        _, graph_request = graph
        graph_request.side_effect = [_response(status_code=500, text="boom"), _response(status_code=202)]

        assert _backend(fail_silently=True).send_messages([_message(), _message()]) == 1

    def test_token_failure_raises(self, graph):
        token_post, graph_request = graph
        token_post.return_value = _response(status_code=401, text="invalid_client")

        with pytest.raises(MSGraphError, match="access token"):
            _backend().send_messages([_message()])
        graph_request.assert_not_called()

    def test_rejects_messages_over_graph_limit(self, graph):
        _, graph_request = graph
        msg = _message()
        msg.attach("big.bin", b"\0" * (MAX_REQUEST_SIZE // 4 * 3), "application/octet-stream")

        with pytest.raises(MSGraphError, match="byte Graph limit"):
            _backend().send_messages([msg])
        graph_request.assert_not_called()
