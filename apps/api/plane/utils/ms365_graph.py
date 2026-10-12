# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import base64
import threading
import time
from urllib.parse import quote

# Third party imports
import requests

GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"
LOGIN_BASE_URL = "https://login.microsoftonline.com"

# Direct attachment POSTs are capped at ~3 MB by Graph; larger files go
# through an upload session in chunks that must be multiples of 320 KiB.
DIRECT_ATTACHMENT_LIMIT = 2_500_000
UPLOAD_SESSION_CHUNK_SIZE = 327_680 * 10

# Graph rejects request bodies over 4 MB.
MAX_REQUEST_SIZE = 4 * 1024 * 1024

# Refresh tokens this many seconds before they expire.
TOKEN_EXPIRY_MARGIN = 300

# Transient statuses retried with Retry-After, within a bounded number of
# attempts and total wait.
RETRY_STATUSES = {429, 503, 504}
MAX_ATTEMPTS = 4
MAX_RETRY_WAIT = 60

_token_cache = {}
_token_cache_lock = threading.Lock()

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
        "hasAttachments",
    ]
)


class MSGraphError(Exception):
    def __init__(self, message, status_code=None, response_text=None):
        self.status_code = status_code
        self.response_text = response_text
        if status_code is not None:
            message = f"{message} (status {status_code}): {response_text}"
        super().__init__(message)


class MSGraphAuthError(MSGraphError):
    pass


class MSGraphMessageTooLarge(MSGraphError):
    pass


def _user_path(mailbox):
    return f"/users/{quote(mailbox, safe='@')}"


def _retry_delay(response, attempt):
    try:
        return max(0.0, float(response.headers.get("Retry-After")))
    except (TypeError, ValueError):
        return float(2**attempt)


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

    @property
    def _cache_key(self):
        return (self.tenant_id, self.client_id, self.client_secret)

    def _get_access_token(self):
        with _token_cache_lock:
            cached = _token_cache.get(self._cache_key)
        if cached and cached[1] > time.monotonic():
            return cached[0]
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
            raise MSGraphAuthError(
                "Failed to acquire MS Graph access token",
                response.status_code,
                response.text[:500],
            )
        payload = response.json()
        access_token = payload.get("access_token")
        if not access_token:
            raise MSGraphAuthError("MS Graph token response did not contain an access token")
        expires_in = int(payload.get("expires_in", 3600))
        with _token_cache_lock:
            _token_cache[self._cache_key] = (access_token, time.monotonic() + expires_in - TOKEN_EXPIRY_MARGIN)
        return access_token

    def _request(self, method, path, params=None, json_body=None, headers=None, data=None):
        request_headers = {"Authorization": f"Bearer {self._get_access_token()}"}
        if headers:
            request_headers.update(headers)
        waited = 0.0
        for attempt in range(MAX_ATTEMPTS):
            response = requests.request(
                method,
                f"{GRAPH_BASE_URL}{path}",
                params=params,
                json=json_body,
                data=data,
                headers=request_headers,
                timeout=self.timeout,
            )
            if response.status_code not in RETRY_STATUSES or attempt == MAX_ATTEMPTS - 1:
                break
            delay = _retry_delay(response, attempt)
            if waited + delay > MAX_RETRY_WAIT:
                break
            time.sleep(delay)
            waited += delay
        if response.status_code in (401, 403):
            with _token_cache_lock:
                _token_cache.pop(self._cache_key, None)
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
            f"{_user_path(mailbox)}/mailFolders/inbox/messages",
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
            f"{_user_path(mailbox)}/messages/{message_id}",
            json_body={"isRead": True},
        )

    def list_message_attachments(self, mailbox, message_id):
        """Attachment metadata only — bytes are fetched per attachment."""
        response = self._request(
            "GET",
            f"{_user_path(mailbox)}/messages/{message_id}/attachments",
            params={"$select": "id,name,contentType,size,isInline,contentId"},
        )
        return response.json().get("value", [])

    def download_attachment(self, mailbox, message_id, attachment_id):
        response = self._request(
            "GET",
            f"{_user_path(mailbox)}/messages/{message_id}/attachments/{attachment_id}/$value",
        )
        return response.content

    def create_reply_draft(self, mailbox, message_id):
        response = self._request("POST", f"{_user_path(mailbox)}/messages/{message_id}/createReply")
        return response.json()

    def update_message(self, mailbox, message_id, payload):
        response = self._request("PATCH", f"{_user_path(mailbox)}/messages/{message_id}", json_body=payload)
        return response.json()

    def add_attachment(self, mailbox, message_id, name, content_type, content, is_inline=False, content_id=None):
        if len(content) > DIRECT_ATTACHMENT_LIMIT:
            self._add_large_attachment(mailbox, message_id, name, content_type, content, is_inline, content_id)
            return
        attachment = {
            "@odata.type": "#microsoft.graph.fileAttachment",
            "name": name,
            "contentType": content_type,
            "contentBytes": base64.b64encode(content).decode("ascii"),
            "isInline": is_inline,
        }
        if content_id:
            attachment["contentId"] = content_id
        self._request("POST", f"{_user_path(mailbox)}/messages/{message_id}/attachments", json_body=attachment)

    def _add_large_attachment(self, mailbox, message_id, name, content_type, content, is_inline, content_id):
        attachment_item = {
            "attachmentType": "file",
            "name": name,
            "size": len(content),
            "isInline": is_inline,
        }
        if content_type:
            attachment_item["contentType"] = content_type
        if content_id:
            attachment_item["contentId"] = content_id
        response = self._request(
            "POST",
            f"{_user_path(mailbox)}/messages/{message_id}/attachments/createUploadSession",
            json_body={"AttachmentItem": attachment_item},
        )
        upload_url = response.json().get("uploadUrl")
        if not upload_url:
            raise MSGraphError("Attachment upload session did not return an upload URL")
        for start in range(0, len(content), UPLOAD_SESSION_CHUNK_SIZE):
            end = min(start + UPLOAD_SESSION_CHUNK_SIZE, len(content))
            # The upload URL is pre-authenticated; no Authorization header.
            chunk_response = requests.put(
                upload_url,
                data=content[start:end],
                headers={
                    "Content-Length": str(end - start),
                    "Content-Range": f"bytes {start}-{end - 1}/{len(content)}",
                },
                timeout=self.timeout,
            )
            if not chunk_response.ok:
                raise MSGraphError(
                    "Attachment upload session chunk failed",
                    chunk_response.status_code,
                    chunk_response.text[:500],
                )

    def send_mime(self, mailbox, mime_bytes):
        """Send a complete RFC 822 message. Graph always saves MIME sends to Sent Items."""
        payload = base64.b64encode(mime_bytes)
        if len(payload) > MAX_REQUEST_SIZE:
            raise MSGraphMessageTooLarge(
                f"Message is {len(payload)} bytes after base64 encoding, over the {MAX_REQUEST_SIZE} byte Graph limit"
            )
        self._request(
            "POST",
            f"{_user_path(mailbox)}/sendMail",
            data=payload,
            headers={"Content-Type": "text/plain"},
        )

    def send_draft(self, mailbox, message_id):
        self._request("POST", f"{_user_path(mailbox)}/messages/{message_id}/send")

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
