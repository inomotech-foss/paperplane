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


class _DisabledLog:
    """Logs why email is disabled once per reason, not once per email."""

    def __init__(self):
        self.reason = None

    def disabled(self, reason):
        if reason != self.reason:
            logger.warning("Outgoing email is disabled: %s", reason)
        self.reason = reason

    def enabled(self):
        self.reason = None


_disabled_log = _DisabledLog()


@dataclass(frozen=True)
class EmailTransport:
    connection: BaseEmailBackend
    from_email: str


def _read_settings(decrypt=True):
    """Email settings. With decrypt=False, secrets stay encrypted and only show presence."""
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
        ],
        decrypt=decrypt,
    )
    settings = {
        "transport": (transport or SMTP).strip().lower(),
        "host": host,
        "user": user,
        "password": password,
        "port": (port or "587").strip(),
        "use_tls": use_tls == "1",
        "use_ssl": use_ssl == "1",
        "from_email": from_email or "",
    }
    if settings["transport"] == MS365:
        settings["tenant_id"], settings["client_id"], settings["client_secret"] = get_ms365_configuration(
            decrypt=decrypt
        )
    return settings


def _invalid_reason(settings):
    """Why the settings cannot send email, or None if they can. Builds nothing."""
    if settings["transport"] == SMTP:
        if not settings["host"]:
            return "EMAIL_HOST is not set"
        if not settings["port"].isdigit():
            return "EMAIL_PORT is not a number"
        if settings["use_tls"] and settings["use_ssl"]:
            return "EMAIL_USE_TLS and EMAIL_USE_SSL are both on"
        return None
    if settings["transport"] == MS365:
        if not (settings["tenant_id"] and settings["client_id"] and settings["client_secret"]):
            return "MS365_TENANT_ID, MS365_CLIENT_ID or MS365_CLIENT_SECRET is not set"
        if "@" not in parseaddr(settings["from_email"])[1]:
            return "EMAIL_FROM is not a valid address"
        return None
    return "EMAIL_TRANSPORT is not smtp or ms365"


def _connect(settings, fail_silently):
    if settings["transport"] == MS365:
        return get_connection(
            GRAPH_BACKEND,
            tenant_id=settings["tenant_id"],
            client_id=settings["client_id"],
            client_secret=settings["client_secret"],
            sender=parseaddr(settings["from_email"])[1],
            timeout=TIMEOUT,
            fail_silently=fail_silently,
        )
    return get_connection(
        host=settings["host"],
        port=int(settings["port"]),
        username=settings["user"],
        password=settings["password"],
        use_tls=settings["use_tls"],
        use_ssl=settings["use_ssl"],
        timeout=TIMEOUT,
        fail_silently=fail_silently,
    )


def get_email_transport(fail_silently=False):
    """Connection and from address for outgoing email, or None if email is not configured."""
    settings = _read_settings()
    reason = _invalid_reason(settings)
    if reason is not None:
        _disabled_log.disabled(reason)
        return None
    _disabled_log.enabled()
    return EmailTransport(_connect(settings, fail_silently), settings["from_email"])


def is_email_configured():
    return _invalid_reason(_read_settings(decrypt=False)) is None


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
