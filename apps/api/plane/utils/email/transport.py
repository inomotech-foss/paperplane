# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import logging
import os
from dataclasses import dataclass
from email.utils import parseaddr

# Django imports
from django.core.mail import EmailMultiAlternatives, get_connection
from django.core.mail.backends.base import BaseEmailBackend

# Module imports
from plane.license.utils.instance_value import get_configuration_value, get_ms365_configuration

SMTP = "smtp"
MS365 = "ms365"
GRAPH_BACKEND = "plane.utils.email.graph_backend.GraphEmailBackend"
TIMEOUT = 30

logger = logging.getLogger("plane.worker")

_last_logged_reason = None


@dataclass(frozen=True)
class EmailTransport:
    connection: BaseEmailBackend
    from_email: str


def _read_settings():
    (
        transport,
        host,
        user,
        password,
        port,
        use_tls,
        use_ssl,
        from_email,
    ) = get_configuration_value(
        [
            {"key": "EMAIL_TRANSPORT", "default": os.environ.get("EMAIL_TRANSPORT", SMTP)},
            {"key": "EMAIL_HOST", "default": os.environ.get("EMAIL_HOST")},
            {"key": "EMAIL_HOST_USER", "default": os.environ.get("EMAIL_HOST_USER")},
            {"key": "EMAIL_HOST_PASSWORD", "default": os.environ.get("EMAIL_HOST_PASSWORD")},
            {"key": "EMAIL_PORT", "default": os.environ.get("EMAIL_PORT", "587")},
            {"key": "EMAIL_USE_TLS", "default": os.environ.get("EMAIL_USE_TLS", "1")},
            {"key": "EMAIL_USE_SSL", "default": os.environ.get("EMAIL_USE_SSL", "0")},
            {"key": "EMAIL_FROM", "default": os.environ.get("EMAIL_FROM", "Team Plane <team@mailer.plane.so>")},
        ]
    )
    return {
        "transport": (transport or SMTP).strip().lower(),
        "host": host,
        "user": user,
        "password": password,
        "port": port,
        "use_tls": use_tls,
        "use_ssl": use_ssl,
        "from_email": from_email,
    }


def _build_transport(settings, fail_silently):
    """Return the transport, or the reason it cannot be built."""
    if settings["transport"] == SMTP:
        if not settings["host"]:
            return None, "EMAIL_HOST is not set"
        connection = get_connection(
            host=settings["host"],
            port=int(settings["port"] or 587),
            username=settings["user"],
            password=settings["password"],
            use_tls=settings["use_tls"] == "1",
            use_ssl=settings["use_ssl"] == "1",
            timeout=TIMEOUT,
            fail_silently=fail_silently,
        )
        return EmailTransport(connection, settings["from_email"]), None

    if settings["transport"] == MS365:
        tenant_id, client_id, client_secret = get_ms365_configuration()
        if not (tenant_id and client_id and client_secret):
            return None, "MS365_TENANT_ID, MS365_CLIENT_ID or MS365_CLIENT_SECRET is not set"
        sender = parseaddr(settings["from_email"] or "")[1]
        if not sender:
            return None, "EMAIL_FROM is not set"
        connection = get_connection(
            GRAPH_BACKEND,
            tenant_id=tenant_id,
            client_id=client_id,
            client_secret=client_secret,
            sender=sender,
            timeout=TIMEOUT,
            fail_silently=fail_silently,
        )
        return EmailTransport(connection, settings["from_email"]), None

    return None, f"EMAIL_TRANSPORT {settings['transport']!r} is not supported"


def get_email_transport(fail_silently=False):
    """Connection and from address for outgoing email, or None if email is not configured."""
    global _last_logged_reason
    transport, reason = _build_transport(_read_settings(), fail_silently)
    if transport is None:
        if reason != _last_logged_reason:
            logger.warning("Outgoing email is disabled: %s", reason)
        _last_logged_reason = reason
    else:
        _last_logged_reason = None
    return transport


def is_email_configured():
    transport, _ = _build_transport(_read_settings(), fail_silently=True)
    return transport is not None


def send_email(subject, to, text_content, html_content=None, attachments=()):
    """Send one email. Returns False without sending if email is not configured."""
    transport = get_email_transport()
    if transport is None:
        return False
    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=transport.from_email,
        to=to,
        connection=transport.connection,
    )
    if html_content is not None:
        msg.attach_alternative(html_content, "text/html")
    for attachment in attachments:
        msg.attach(*attachment)
    msg.send()
    return True
