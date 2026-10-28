# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import timedelta

from bs4 import BeautifulSoup
from celery import shared_task
from django.utils import timezone

from plane.db.models import EmailNotificationLog, Notification, Page, PageLog, ProjectPage, User
from plane.utils.exception_logger import log_exception
from plane.utils.mentions import mentionable_user_ids
from plane.utils.notification_preference import notification_preference

# Mentions removed within this window never notify anyone.
MENTION_DELAY = timedelta(minutes=5)
SNIPPET_LENGTH = 300
BLOCK_TAGS = ["p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "td", "th", "blockquote"]


def mention_snippet(description_html, transaction_ids):
    """Plain text of the block holding the first of the given mentions, with user mentions as @name.

    None if none of the mentions is still in the page.
    """
    soup = BeautifulSoup(description_html or "", "html.parser")
    for tag in soup.find_all("mention-component"):
        if tag.get("id") not in transaction_ids:
            continue
        block = tag.find_parent(BLOCK_TAGS) or tag.parent
        mentions = block.find_all("mention-component", attrs={"entity_name": "user_mention"})
        names = User.objects.filter(pk__in=[m.get("entity_identifier") for m in mentions]).values_list(
            "id", "display_name"
        )
        names = {str(user_id): name for user_id, name in names}
        for mention in mentions:
            mention.replace_with(f"@{names.get(mention.get('entity_identifier'), '')}")
        return " ".join(block.get_text().split())[:SNIPPET_LENGTH]
    return None


@shared_task
def notify_page_mentions():
    """Notify users once their newest pending mention on a page is MENTION_DELAY old, once per page and user."""
    pending = (
        PageLog.objects.filter(entity_name="user_mention", notified_at__isnull=True)
        .order_by("created_at")
        .values("id", "page_id", "entity_identifier", "triggered_by_id", "transaction", "created_at")
    )
    groups = {}
    for log in pending:
        groups.setdefault((log["page_id"], str(log["entity_identifier"])), []).append(log)

    cutoff = timezone.now() - MENTION_DELAY
    for (page_id, receiver_id), logs in groups.items():
        if logs[-1]["created_at"] > cutoff:
            continue
        claimed = PageLog.objects.filter(pk__in=[log["id"] for log in logs], notified_at__isnull=True).update(
            notified_at=timezone.now()
        )
        if not claimed:
            continue
        try:
            _notify(page_id, receiver_id, logs)
        except Exception as e:
            log_exception(e)


def _notify(page_id, receiver_id, logs):
    actor_id = logs[-1]["triggered_by_id"]
    if not actor_id or str(actor_id) == receiver_id:
        return
    page = Page.objects.filter(pk=page_id, archived_at__isnull=True).first()
    if not page or (page.access == Page.PRIVATE_ACCESS and str(page.owned_by_id) != receiver_id):
        return
    snippet = mention_snippet(page.description_html, {str(log["transaction"]) for log in logs})
    if snippet is None:
        return
    project = next(
        (
            project_page.project
            for project_page in ProjectPage.objects.filter(page=page, project__archived_at__isnull=True)
            .select_related("project__workspace")
            .order_by("created_at")
            if mentionable_user_ids(project_page.project, {receiver_id})
        ),
        None,
    )
    if not project:
        return

    actor = User.objects.get(pk=actor_id)
    page_data = {"id": str(page.id), "name": page.name, "project_id": str(project.id)}

    Notification.objects.create(
        workspace=project.workspace,
        project=project,
        sender="in_app:page:mentioned",
        triggered_by=actor,
        receiver_id=receiver_id,
        entity_identifier=page.id,
        entity_name="page",
        title=f"{actor.display_name or actor.email} mentioned you on {page.name}",
        message_stripped=snippet,
        data={"page": {**page_data, "workspace_slug": project.workspace.slug}},
    )
    if notification_preference(receiver_id).mention:
        EmailNotificationLog.objects.create(
            triggered_by=actor,
            receiver_id=receiver_id,
            entity_identifier=page.id,
            entity_name="page",
            data={"page": page_data, "mention": {"snippet": snippet}},
        )
