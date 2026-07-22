# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
import requests

GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"
LOGIN_BASE_URL = "https://login.microsoftonline.com"

MESSAGE_SELECT_FIELDS = ",".join(
    [
        "id",
        "subject",
        "body",
        "from",
        "toRecipients",
        "ccRecipients",
        "conversationId",
        "internetMessageId",
        "receivedDateTime",
    ]
)


class MSGraphError(Exception):
    def __init__(self, message, status_code=None, response_text=None):
        self.status_code = status_code
        self.response_text = response_text
        if status_code is not None:
            message = f"{message} (status {status_code}): {response_text}"
        super().__init__(message)


class MSGraphMailClient:
    """Minimal Microsoft Graph mail client using the client-credentials flow.

    Requires an Azure app registration with application permissions
    Mail.ReadWrite and Mail.Send (ideally scoped to the service mailboxes via
    an application access policy).
    """

    def __init__(self, tenant_id, client_id, client_secret, timeout=30):
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.client_secret = client_secret
        self.timeout = timeout
        self._access_token = None

    def _get_access_token(self):
        if self._access_token:
            return self._access_token
        response = requests.post(
            f"{LOGIN_BASE_URL}/{self.tenant_id}/oauth2/v2.0/token",
            data={
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "scope": "https://graph.microsoft.com/.default",
            },
            timeout=self.timeout,
        )
        if not response.ok:
            raise MSGraphError(
                "Failed to acquire MS Graph access token",
                response.status_code,
                response.text[:500],
            )
        self._access_token = response.json().get("access_token")
        if not self._access_token:
            raise MSGraphError("MS Graph token response did not contain an access token")
        return self._access_token

    def _request(self, method, path, params=None, json_body=None, headers=None):
        request_headers = {"Authorization": f"Bearer {self._get_access_token()}"}
        if headers:
            request_headers.update(headers)
        response = requests.request(
            method,
            f"{GRAPH_BASE_URL}{path}",
            params=params,
            json=json_body,
            headers=request_headers,
            timeout=self.timeout,
        )
        if not response.ok:
            raise MSGraphError(
                f"MS Graph request {method} {path} failed",
                response.status_code,
                response.text[:500],
            )
        return response

    def list_unread_messages(self, mailbox, top=50):
        response = self._request(
            "GET",
            f"/users/{mailbox}/mailFolders/inbox/messages",
            params={
                "$filter": "isRead eq false",
                "$orderby": "receivedDateTime asc",
                "$top": top,
                "$select": MESSAGE_SELECT_FIELDS,
            },
            headers={"Prefer": 'outlook.body-content-type="text"'},
        )
        return response.json().get("value", [])

    def mark_message_read(self, mailbox, message_id):
        self._request(
            "PATCH",
            f"/users/{mailbox}/messages/{message_id}",
            json_body={"isRead": True},
        )

    def create_subscription(self, mailbox, notification_url, client_state, expiration):
        """Subscribe to change notifications for new messages in the inbox.

        Graph validates notification_url synchronously (the receiver must echo
        the validationToken), so the endpoint has to be publicly reachable.
        """
        response = self._request(
            "POST",
            "/subscriptions",
            json_body={
                "changeType": "created",
                "notificationUrl": notification_url,
                "resource": f"/users/{mailbox}/mailFolders('inbox')/messages",
                "expirationDateTime": expiration,
                "clientState": client_state,
            },
        )
        return response.json()

    def renew_subscription(self, subscription_id, expiration):
        response = self._request(
            "PATCH",
            f"/subscriptions/{subscription_id}",
            json_body={"expirationDateTime": expiration},
        )
        return response.json()

    def delete_subscription(self, subscription_id):
        self._request("DELETE", f"/subscriptions/{subscription_id}")

    def reply_to_message(self, mailbox, message_id, body_html, to_emails, cc_emails=None):
        """Reply to an existing message; Exchange keeps the thread intact.

        Passing recipients overrides the ones derived from the original
        message, which is how recipient changes on the ticket take effect.
        """
        message = {
            "body": {"contentType": "html", "content": body_html},
            "toRecipients": [{"emailAddress": {"address": email}} for email in to_emails],
        }
        if cc_emails:
            message["ccRecipients"] = [{"emailAddress": {"address": email}} for email in cc_emails]
        self._request(
            "POST",
            f"/users/{mailbox}/messages/{message_id}/reply",
            json_body={"message": message},
        )
