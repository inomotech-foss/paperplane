# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Run a Celery task as the user whose request queued it.

The user's id travels in a message header. The worker sets that user as the
current user while the task runs, so rows the task writes record their creator
just like rows written in the request. A task queued without a user, e.g. by
beat, runs without one.
"""

import threading

from celery.signals import before_task_publish, task_postrun, task_prerun
from crum import get_current_user, set_current_user

HEADER = "plane_actor_id"

_previous = threading.local()


@before_task_publish.connect
def attach_actor(headers=None, **kwargs):
    from plane.db.mixins import current_user_id

    user_id = current_user_id()
    if headers is not None and user_id is not None:
        headers.setdefault(HEADER, str(user_id))


@task_prerun.connect
def act_as_actor(task=None, **kwargs):
    stack = getattr(_previous, "stack", None)
    if stack is None:
        stack = _previous.stack = []
    stack.append(get_current_user())
    actor_id = task.request.get(HEADER) if task is not None else None
    if actor_id:
        from django.db import close_old_connections

        from plane.db.models import User

        # Runs before Celery's own connection cleanup for the task
        if not task.request.is_eager:
            close_old_connections()

        set_current_user(User.objects.filter(pk=actor_id).first())


@task_postrun.connect
def restore_actor(**kwargs):
    stack = getattr(_previous, "stack", None)
    set_current_user(stack.pop() if stack else None)
