# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
from email.utils import parseaddr

# Django imports
from django.core.mail.backends.base import BaseEmailBackend

# Module imports
from plane.utils.ms365_graph import MSGraphMailClient


class GraphEmailBackend(BaseEmailBackend):
    """Sends each message as raw MIME through Microsoft Graph sendMail.

    The app registration needs the Mail.Send application permission. The
    message is sent from ``sender``, or from the address in its From header.
    """

    def __init__(
        self,
        tenant_id=None,
        client_id=None,
        client_secret=None,
        sender=None,
        timeout=30,
        fail_silently=False,
        **kwargs,
    ):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.sender = sender
        self.client = MSGraphMailClient(tenant_id, client_id, client_secret, timeout=timeout)

    def send_messages(self, email_messages):
        sent = 0
        for message in email_messages:
            try:
                if self._send(message):
                    sent += 1
            except Exception:
                if not self.fail_silently:
                    raise
        return sent

    def _send(self, message):
        if not message.recipients():
            return False
        mime = message.message()
        # Django leaves Bcc out of the headers. Exchange reads it and strips it before delivery.
        if message.bcc:
            mime["Bcc"] = ", ".join(message.bcc)
        mailbox = self.sender or parseaddr(message.from_email)[1]
        self.client.send_mime(mailbox, mime.as_bytes(linesep="\r\n"))
        return True
