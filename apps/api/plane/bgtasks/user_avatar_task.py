# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import hashlib
import uuid
from io import BytesIO
from urllib.parse import urlparse

# Django imports
from django.conf import settings

# Third party imports
from celery import shared_task

# Module imports
from plane.db.models import Account, FileAsset, User
from plane.settings.storage import S3Storage
from plane.utils.exception_logger import log_exception
from plane.utils.url_security import pinned_fetch_following_redirects

# Microsoft Graph photo-endpoint hosts (global + national clouds).
MS_GRAPH_HOSTS = frozenset(
    {
        "graph.microsoft.com",
        "graph.microsoft.us",
        "dod-graph.microsoft.us",
        "microsoftgraph.chinacloudapi.cn",
    }
)

AVATAR_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
}


def is_graph_url(url):
    return (urlparse(url or "").hostname or "").lower() in MS_GRAPH_HOSTS


def avatar_download_headers(user_id, provider, avatar_url):
    # Graph photos are token-gated. Send the bearer only to Graph hosts.
    if provider != "oidc" or not is_graph_url(avatar_url):
        return {}
    token = (
        Account.objects.filter(user_id=user_id, provider=provider)
        .order_by("-last_connected_at")
        .values_list("access_token", flat=True)
        .first()
    )
    return {"Authorization": f"Bearer {token}"} if token else {}


def fetch_avatar_bytes(avatar_url, headers=None):
    """Fetch avatar bytes. Returns (content, content_type, extension) or None."""
    if not avatar_url:
        return None

    try:
        # The avatar URL is attacker-influenceable, so pin to the validated IP and
        # re-validate every redirect hop - GHSA-cv9p-325g-wmv5 / GHSA-hx79-5pj5-qh42.
        # stream=True so the size cap below bounds memory.
        response, _ = pinned_fetch_following_redirects(
            "GET", avatar_url, headers=headers or {}, timeout=10, max_redirects=5, stream=True
        )
        try:
            response.raise_for_status()

            content_length = response.headers.get("Content-Length")
            max_size = settings.DATA_UPLOAD_MAX_MEMORY_SIZE
            if content_length and int(content_length) > max_size:
                return None

            content_type = response.headers.get("Content-Type", "image/jpeg")
            extension = AVATAR_EXTENSIONS.get(content_type)
            if not extension:
                return None

            chunks = []
            total_size = 0
            for chunk in response.iter_content(chunk_size=8192):
                total_size += len(chunk)
                if total_size > max_size:
                    return None
                chunks.append(chunk)
            content = b"".join(chunks)
        finally:
            response.close()

        return content, content_type, extension
    except Exception as e:
        log_exception(e)
        return None


def store_avatar(content, content_type, extension, source_hash, user, provider):
    """Upload avatar bytes to storage and create the FileAsset. Returns it or None."""
    try:
        filename = f"{uuid.uuid4().hex}-user-avatar.{extension}"
        storage = S3Storage()

        if not storage.upload_file(file_obj=BytesIO(content), object_name=filename, content_type=content_type):
            return None

        # source_hash lets a later login skip re-upload of an unchanged image.
        return FileAsset.objects.create(
            attributes={
                "name": f"{provider}-avatar.{extension}",
                "type": content_type,
                "size": len(content),
                "source_hash": source_hash,
            },
            asset=filename,
            size=len(content),
            user=user,
            created_by=user,
            entity_type=FileAsset.EntityTypeContext.USER_AVATAR,
            is_uploaded=True,
            storage_metadata=storage.get_object_metadata(object_name=filename),
        )
    except Exception as e:
        log_exception(e)
        return None


def delete_avatar_asset(asset):
    try:
        S3Storage().delete_files(object_names=[asset.asset.name])
        asset.delete()
    except Exception as e:
        log_exception(e)


@shared_task
def sync_user_avatar(user_id, provider, avatar_url, fallback_url=""):
    """Store the provider avatar as the user's avatar asset when its content changed."""
    user = User.objects.filter(id=user_id).select_related("avatar_asset").first()
    if not user or not avatar_url:
        return

    fetched = fetch_avatar_bytes(avatar_url, avatar_download_headers(user_id, provider, avatar_url))
    if fetched is None:
        # A failed fetch never removes the current avatar.
        if fallback_url and not user.avatar_asset_id and not user.avatar:
            user.avatar = fallback_url
            user.save(update_fields=["avatar"])
        return

    content, content_type, extension = fetched
    source_hash = hashlib.sha256(content).hexdigest()
    old_asset = user.avatar_asset
    if old_asset and (old_asset.attributes or {}).get("source_hash") == source_hash:
        return

    new_asset = store_avatar(content, content_type, extension, source_hash, user, provider)
    if new_asset is None:
        return

    user.avatar_asset = new_asset
    user.save(update_fields=["avatar_asset"])
    if old_asset:
        delete_avatar_asset(old_asset)
