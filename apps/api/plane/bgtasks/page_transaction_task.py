# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import logging
import uuid

# Django imports
from django.utils import timezone

# Third-party imports
from bs4 import BeautifulSoup

# App imports
from celery import shared_task
from plane.db.models import Page, PageLog, WorkspaceMember
from plane.utils.exception_logger import log_exception

logger = logging.getLogger("plane.worker")

COMPONENT_MAP = {
    "mention-component": {
        "attributes": ["id", "entity_identifier", "entity_name", "entity_type", "author"],
        "extract": lambda m: {
            "entity_name": m.get("entity_name"),
            "entity_type": None,
            "entity_identifier": m.get("entity_identifier"),
        },
    },
    "image-component": {
        "attributes": ["id", "src"],
        "extract": lambda m: {
            "entity_name": "image",
            "entity_type": None,
            "entity_identifier": m.get("src"),
        },
    },
}

component_map = {
    **COMPONENT_MAP,
}


def extract_all_components(description_html):
    """
    Extracts all component types from the HTML value in a single pass.
    Returns a dict mapping component_type -> list of extracted entities.
    """
    try:
        if not description_html:
            return {component: [] for component in component_map.keys()}

        soup = BeautifulSoup(description_html, "html.parser")
        results = {}

        for component, config in component_map.items():
            attributes = config.get("attributes", ["id"])
            component_tags = soup.find_all(component)

            entities = []
            for tag in component_tags:
                entity = {attr: tag.get(attr) for attr in attributes}
                entities.append(entity)

            results[component] = entities

        return results

    except Exception:
        return {component: [] for component in component_map.keys()}


def get_entity_details(component: str, mention: dict):
    """
    Normalizes mention attributes into entity_name, entity_type, entity_identifier.
    """
    config = component_map.get(component)
    if not config:
        return {"entity_name": None, "entity_type": None, "entity_identifier": None}
    return config["extract"](mention)


def mention_author(mention, page, actor_id):
    """The user who inserted the mention if they belong to the workspace, else the user who saved."""
    try:
        author = uuid.UUID(str(mention.get("author")))
    except ValueError:
        return actor_id
    if WorkspaceMember.objects.filter(workspace_id=page.workspace_id, member_id=author, is_active=True).exists():
        return str(author)
    return actor_id


@shared_task
def page_transaction(new_description_html, old_description_html, page_id, actor_id=None):
    """
    Tracks changes in page content (mentions, embeds, etc.)
    and logs them in PageLog for audit and reference.

    User mentions added in a save by ``actor_id`` stay pending until
    ``notify_page_mentions`` sends them. Without an actor nothing is notified.
    """
    try:
        page = Page.objects.get(pk=page_id)

        has_existing_logs = PageLog.objects.filter(page_id=page_id).exists()

        # Extract all components in a single pass (optimized)
        old_components = extract_all_components(old_description_html)
        new_components = extract_all_components(new_description_html)

        new_transactions = []
        deleted_transaction_ids = set()

        for component in component_map.keys():
            old_entities = old_components[component]
            new_entities = new_components[component]

            old_ids = {m.get("id") for m in old_entities if m.get("id")}
            new_ids = {m.get("id") for m in new_entities if m.get("id")}
            deleted_transaction_ids.update(old_ids - new_ids)

            for mention in new_entities:
                mention_id = mention.get("id")
                if not mention_id or (mention_id in old_ids and has_existing_logs):
                    continue

                details = get_entity_details(component, mention)
                current_time = timezone.now()
                notify = actor_id and details["entity_name"] == "user_mention" and mention_id not in old_ids

                new_transactions.append(
                    PageLog(
                        transaction=mention_id,
                        page_id=page_id,
                        entity_identifier=details["entity_identifier"],
                        entity_name=details["entity_name"],
                        entity_type=details["entity_type"],
                        workspace_id=page.workspace_id,
                        triggered_by_id=mention_author(mention, page, actor_id) if notify else actor_id,
                        notified_at=None if notify else current_time,
                        created_at=current_time,
                        updated_at=current_time,
                    )
                )

        # Bulk insert and cleanup
        if new_transactions:
            PageLog.objects.bulk_create(new_transactions, batch_size=50, ignore_conflicts=True)

        if deleted_transaction_ids:
            PageLog.all_objects.filter(page_id=page_id, transaction__in=deleted_transaction_ids).delete()

    except Page.DoesNotExist:
        return
    except Exception as e:
        log_exception(e)
        return
