# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import logging
from unittest.mock import patch

import pytest
from django.core import mail
from django.urls import reverse

from plane.license.models import InstanceConfiguration
from plane.license.utils.encryption import encrypt_data
from plane.utils.email import transport
from plane.utils.email.graph_backend import GraphEmailBackend
from plane.utils.email.transport import get_email_transport, is_email_configured, send_email
from plane.utils.ms365_graph import MSGraphError


def configure(**values):
    for key, value in values.items():
        encrypted = key in ("EMAIL_HOST_PASSWORD", "MS365_CLIENT_SECRET")
        InstanceConfiguration.objects.update_or_create(
            key=key,
            defaults={
                "value": encrypt_data(value) if encrypted else value,
                "is_encrypted": encrypted,
                "category": "TEST",
            },
        )


SMTP_SETTINGS = {
    "EMAIL_TRANSPORT": "smtp",
    "EMAIL_HOST": "smtp.example.com",
    "EMAIL_PORT": "2525",
    "EMAIL_HOST_USER": "user",
    "EMAIL_HOST_PASSWORD": "pass",
    "EMAIL_USE_TLS": "1",
    "EMAIL_USE_SSL": "0",
    "EMAIL_FROM": "Plane <noreply@example.com>",
}

MS365_SETTINGS = {
    "EMAIL_TRANSPORT": "ms365",
    "EMAIL_HOST": "",
    "EMAIL_FROM": "Plane <noreply@example.com>",
    "MS365_TENANT_ID": "tenant",
    "MS365_CLIENT_ID": "client",
    "MS365_CLIENT_SECRET": "secret",
}


@pytest.fixture(autouse=True)
def reset_logged_reason():
    transport._last_logged_reason = None
    yield
    transport._last_logged_reason = None


@pytest.mark.unit
@pytest.mark.django_db
class TestEmailTransport:
    def test_smtp_uses_configured_server(self):
        configure(**SMTP_SETTINGS)

        result = get_email_transport()

        # The test settings swap the SMTP backend for locmem, so check what reaches get_connection.
        with patch("plane.utils.email.transport.get_connection") as get_connection:
            get_email_transport()
        assert get_connection.call_args.kwargs == {
            "host": "smtp.example.com",
            "port": 2525,
            "username": "user",
            "password": "pass",
            "use_tls": True,
            "use_ssl": False,
            "timeout": 30,
            "fail_silently": False,
        }
        assert result.from_email == "Plane <noreply@example.com>"

    def test_smtp_without_host_is_not_configured(self):
        configure(**{**SMTP_SETTINGS, "EMAIL_HOST": ""})

        assert get_email_transport() is None
        assert is_email_configured() is False

    def test_ms365_uses_graph_backend(self):
        configure(**MS365_SETTINGS)

        result = get_email_transport()

        assert isinstance(result.connection, GraphEmailBackend)
        assert result.connection.sender == "noreply@example.com"
        assert result.connection.client.tenant_id == "tenant"
        assert result.connection.client.client_secret == "secret"
        assert result.from_email == "Plane <noreply@example.com>"
        assert is_email_configured() is True

    @pytest.mark.parametrize("missing", ["MS365_TENANT_ID", "MS365_CLIENT_ID", "MS365_CLIENT_SECRET", "EMAIL_FROM"])
    def test_ms365_needs_credentials_and_sender(self, missing):
        configure(**{**MS365_SETTINGS, missing: ""})

        assert get_email_transport() is None
        assert is_email_configured() is False

    def test_unknown_transport_is_not_configured(self):
        configure(**{**SMTP_SETTINGS, "EMAIL_TRANSPORT": "carrier-pigeon"})

        assert get_email_transport() is None

    def test_transport_defaults_to_smtp(self):
        configure(**{key: value for key, value in SMTP_SETTINGS.items() if key != "EMAIL_TRANSPORT"})

        assert get_email_transport() is not None

    def test_logs_unconfigured_once(self, caplog):
        configure(**{**SMTP_SETTINGS, "EMAIL_HOST": ""})

        with caplog.at_level(logging.WARNING, logger="plane.worker"):
            get_email_transport()
            get_email_transport()
            send_email(subject="s", to=["a@example.com"], text_content="t")

        warnings = [record for record in caplog.records if "Outgoing email is disabled" in record.message]
        assert len(warnings) == 1
        assert "EMAIL_HOST" in warnings[0].message

    def test_logs_again_after_email_was_configured(self, caplog):
        configure(**{**SMTP_SETTINGS, "EMAIL_HOST": ""})
        with caplog.at_level(logging.WARNING, logger="plane.worker"):
            get_email_transport()
            configure(EMAIL_HOST="smtp.example.com")
            get_email_transport()
            configure(EMAIL_HOST="")
            get_email_transport()

        warnings = [record for record in caplog.records if "Outgoing email is disabled" in record.message]
        assert len(warnings) == 2


@pytest.mark.unit
@pytest.mark.django_db
class TestSendEmail:
    def test_sends_text_html_and_attachments(self):
        configure(**SMTP_SETTINGS)

        sent = send_email(
            subject="Subject",
            to=["user@example.com"],
            text_content="text",
            html_content="<p>html</p>",
            attachments=[("report.csv", "a,b", "text/csv")],
        )

        assert sent is True
        assert len(mail.outbox) == 1
        message = mail.outbox[0]
        assert message.from_email == "Plane <noreply@example.com>"
        assert message.to == ["user@example.com"]
        assert message.body == "text"
        assert message.alternatives[0][0] == "<p>html</p>"
        assert message.attachments[0][0] == "report.csv"

    def test_skips_when_not_configured(self):
        configure(**{**SMTP_SETTINGS, "EMAIL_HOST": ""})

        assert send_email(subject="s", to=["user@example.com"], text_content="t") is False
        assert mail.outbox == []

    def test_ms365_sends_through_graph(self):
        configure(**MS365_SETTINGS)

        with patch.object(GraphEmailBackend, "send_messages", return_value=1) as send_messages:
            assert send_email(subject="s", to=["user@example.com"], text_content="t") is True

        (messages,) = send_messages.call_args.args
        assert messages[0].to == ["user@example.com"]
        assert mail.outbox == []


@pytest.mark.unit
@pytest.mark.django_db
class TestEmailEndpoints:
    def test_test_email_with_ms365(self, instance_admin_client):
        configure(**MS365_SETTINGS)

        with patch.object(GraphEmailBackend, "send_messages", return_value=1) as send_messages:
            response = instance_admin_client.post(
                reverse("email-credential-check"), {"receiver_email": "admin@example.com"}, format="json"
            )

        assert response.status_code == 200
        assert send_messages.call_args.args[0][0].to == ["admin@example.com"]

    def test_test_email_reports_graph_error(self, instance_admin_client):
        configure(**MS365_SETTINGS)

        with patch.object(GraphEmailBackend, "send_messages", side_effect=MSGraphError("denied", 403, "nope")):
            response = instance_admin_client.post(
                reverse("email-credential-check"), {"receiver_email": "admin@example.com"}, format="json"
            )

        assert response.status_code == 400
        assert "403" in response.data["error"]

    def test_test_email_when_not_configured(self, instance_admin_client):
        configure(**{**SMTP_SETTINGS, "EMAIL_HOST": ""})

        response = instance_admin_client.post(
            reverse("email-credential-check"), {"receiver_email": "admin@example.com"}, format="json"
        )

        assert response.status_code == 400
        assert response.data["error"] == "Email is not configured."

    def test_disable_resets_transport_and_keeps_ms365_credentials(self, instance_admin_client):
        configure(**MS365_SETTINGS)

        response = instance_admin_client.delete(reverse("disable-email-configuration"))

        assert response.status_code == 200
        values = dict(InstanceConfiguration.objects.values_list("key", "value"))
        assert values["EMAIL_TRANSPORT"] == "smtp"
        assert values["EMAIL_FROM"] == ""
        assert values["MS365_TENANT_ID"] == "tenant"
        assert is_email_configured() is False

    def test_instance_reports_ms365_as_configured(self, api_client, instance_admin_client):
        configure(**MS365_SETTINGS)

        response = api_client.get(reverse("instance"))

        assert response.data["config"]["is_smtp_configured"] is True
