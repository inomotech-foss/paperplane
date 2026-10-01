# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import transaction
from django.db.models import Exists, OuterRef
from django.db.models.fields.related import ForeignObjectRel

from plane.db.mixins import SoftDeletionQuerySet
from plane.db.models import (
    Account,
    Profile,
    ProjectMember,
    User,
    UserNotificationPreference,
    UserRecentVisit,
    WorkspaceMember,
)
from plane.license.models import InstanceAdmin

from .user_lifecycle import UserLifecycleError, soft_delete_user

# Tables where two memberships collapse into one with the higher role.
ROLE_TABLES = (
    (WorkspaceMember, "member", "workspace"),
    (ProjectMember, "member", "project"),
    (InstanceAdmin, "user", "instance"),
)

# One row per user and scope, without a database constraint saying so.
LOGICAL_UNIQUE_TABLES = (
    (UserNotificationPreference, "user", ("workspace_id", "project_id")),
    (UserRecentVisit, "user", ("workspace_id", "entity_identifier", "entity_name")),
)

# The survivor keeps its own profile.
SKIPPED_MODELS = (Profile,)


class MergeError(UserLifecycleError):
    pass


def label(model, field_name):
    return f"{model._meta.app_label}.{model._meta.object_name}.{field_name}"


def unique_sets(model, field_name):
    """Field sets of the unique constraints that include the user field, with their condition."""
    sets = []
    if model._meta.get_field(field_name).unique:
        sets.append(((field_name,), None))
    for fields in model._meta.unique_together:
        if field_name in fields:
            sets.append((tuple(fields), None))
    for constraint in model._meta.constraints:
        fields = getattr(constraint, "fields", ())
        if field_name in fields:
            sets.append((tuple(fields), getattr(constraint, "condition", None)))
    return sets


def user_relations():
    """Every (model, field name) that references User, M2M through tables included."""
    seen = set()
    for field in User._meta.get_fields(include_hidden=True):
        if isinstance(field, ForeignObjectRel):
            if field.many_to_many:
                model, name = field.through, field.field.m2m_reverse_field_name()
            else:
                model, name = field.related_model, field.field.name
        elif field.many_to_many:
            model, name = field.remote_field.through, field.m2m_field_name()
        else:
            continue
        if model in SKIPPED_MODELS or (model, name) in seen:
            continue
        seen.add((model, name))
        yield model, name


def hard_delete(queryset):
    if isinstance(queryset, SoftDeletionQuerySet):
        return queryset.delete(soft=False)[0]
    return queryset.delete()[0]


def repoint(model, field_name, source, survivor):
    """Move rows from source to survivor, dropping the ones a unique constraint would reject."""
    manager = model._base_manager
    source_rows = manager.filter(**{field_name: source})
    dropped = 0
    for fields, condition in unique_sets(model, field_name):
        others = [f for f in fields if f != field_name]
        survivor_rows = manager.filter(**{field_name: survivor}, **{f: OuterRef(f) for f in others})
        conflicting = source_rows.filter(Exists(survivor_rows))
        if condition is not None:
            conflicting = source_rows.filter(Exists(survivor_rows.filter(condition)), condition)
        dropped += hard_delete(conflicting)
    moved = source_rows.update(**{field_name: survivor})
    return moved, dropped


def merge_roles(model, user_field, scope_field, source, survivor):
    moved = dropped = 0
    for row in model.objects.filter(**{user_field: source}):
        scope = getattr(row, f"{scope_field}_id")
        kept = model.objects.filter(**{user_field: survivor, f"{scope_field}_id": scope}).first()
        if kept is None:
            setattr(row, user_field, survivor)
            row.save()
            moved += 1
            continue
        kept.role = max(kept.role, row.role)
        if hasattr(kept, "is_active"):
            kept.is_active = kept.is_active or row.is_active
        kept.save()
        row.delete(soft=False)
        dropped += 1
    return moved, dropped


def merge_logical_unique(model, user_field, scope_fields, source, survivor):
    moved = dropped = 0
    for row in model.objects.filter(**{user_field: source}):
        scope = {field: getattr(row, field) for field in scope_fields}
        if model.objects.filter(**{user_field: survivor}, **scope).exists():
            row.delete(soft=False)
            dropped += 1
        else:
            setattr(row, user_field, survivor)
            row.save()
            moved += 1
    return moved, dropped


def merge_accounts(source, survivor):
    moved = dropped = 0
    taken = set(Account.objects.filter(user=survivor).values_list("provider", flat=True))
    for account in Account.objects.filter(user=source):
        if account.provider in taken:
            account.delete()
            dropped += 1
        else:
            account.user = survivor
            account.save()
            moved += 1
    return moved, dropped


def check_mergeable(survivor, source, actor=None):
    if survivor.pk == source.pk:
        raise MergeError("A user cannot be merged into itself.")
    if survivor.is_bot or source.is_bot:
        raise MergeError("Bots cannot be merged.")
    if survivor.deleted_at or source.deleted_at:
        raise MergeError("Deleted users cannot be merged.")
    if actor is not None and source.pk == actor.pk:
        raise MergeError("You cannot merge your own account into another one.")


def merge_users(survivor, source, *, keep_source_email=False, dry_run=False, actor=None):
    """Fold source into survivor. Returns per-relation counts and the resulting email."""
    check_mergeable(survivor, source, actor)
    counts = {}

    def record(key, moved, dropped):
        previous = counts.get(key, {"moved": 0, "dropped": 0})
        moved += previous["moved"]
        dropped += previous["dropped"]
        if moved or dropped:
            counts[key] = {"moved": moved, "dropped": dropped}

    with transaction.atomic():
        record(label(Account, "user"), *merge_accounts(source, survivor))
        for model, user_field, scope_field in ROLE_TABLES:
            record(label(model, user_field), *merge_roles(model, user_field, scope_field, source, survivor))
        for model, user_field, scope_fields in LOGICAL_UNIQUE_TABLES:
            record(label(model, user_field), *merge_logical_unique(model, user_field, scope_fields, source, survivor))
        for model, field_name in user_relations():
            record(label(model, field_name), *repoint(model, field_name, source, survivor))

        source_email = source.email
        source_verified = source.is_email_verified
        soft_delete_user(source, merged_into=survivor)

        if keep_source_email:
            survivor.email = source_email
        survivor.is_email_verified = survivor.is_email_verified or source_verified
        survivor.save()

        if dry_run:
            transaction.set_rollback(True)

    result = {
        "survivor": str(survivor.id),
        "source": str(source.id),
        "email": survivor.email,
        "relations": counts,
    }
    if dry_run:
        survivor.refresh_from_db()
        source.refresh_from_db()
    return result
