# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.utils import timezone
from django.apps import apps
from django.conf import settings
from django.db import IntegrityError, models, transaction
from django.db.models.fields.related import OneToOneRel


# Third party imports
from celery import shared_task


@shared_task
def soft_delete_related_objects(app_label, model_name, instance_pk, using=None):
    """
    Soft delete related objects for a given model instance
    """
    # Get the model class using app registry
    model_class = apps.get_model(app_label, model_name)

    # Get the instance using all_objects to ensure we can get even if it's already soft deleted
    try:
        instance = model_class.all_objects.get(pk=instance_pk)
    except model_class.DoesNotExist:
        return

    # Get all related fields that are reverse relationships
    all_related = [
        f for f in instance._meta.get_fields() if (f.one_to_many or f.one_to_one) and f.auto_created and not f.concrete
    ]

    # Handle each related field
    for relation in all_related:
        related_name = relation.get_accessor_name()

        # Skip if the relation doesn't exist
        if not hasattr(instance, related_name):
            continue

        # Get the on_delete behavior name
        on_delete_name = relation.on_delete.__name__ if hasattr(relation.on_delete, "__name__") else ""

        # A restricted relation blocks a delete, it never cascades one.
        if on_delete_name in ("DO_NOTHING", "RESTRICT"):
            continue

        elif on_delete_name == "SET_NULL":
            # Handle SET_NULL relationships
            if isinstance(relation, OneToOneRel):
                # For OneToOne relationships
                related_obj = getattr(instance, related_name, None)
                if related_obj and isinstance(related_obj, models.Model):
                    setattr(related_obj, relation.remote_field.name, None)
                    related_obj.save(update_fields=[relation.remote_field.name])
            else:
                # For other relationships
                related_queryset = getattr(instance, related_name).all()
                related_queryset.update(**{relation.remote_field.name: None})

        else:
            # Handle CASCADE and other delete behaviors
            try:
                if relation.one_to_one:
                    # Handle OneToOne relationships
                    related_obj = getattr(instance, related_name, None)
                    if related_obj:
                        if hasattr(related_obj, "deleted_at"):
                            if not related_obj.deleted_at:
                                related_obj.deleted_at = timezone.now()
                                related_obj.save()
                                # Recursively handle related objects
                                soft_delete_related_objects(
                                    related_obj._meta.app_label,
                                    related_obj._meta.model_name,
                                    related_obj.pk,
                                    using,
                                )
                else:
                    # Handle other relationships
                    related_queryset = getattr(instance, related_name)(manager="objects").all()

                    for related_obj in related_queryset:
                        if hasattr(related_obj, "deleted_at"):
                            if not related_obj.deleted_at:
                                related_obj.deleted_at = timezone.now()
                                related_obj.save()
                                # Recursively handle related objects
                                soft_delete_related_objects(
                                    related_obj._meta.app_label,
                                    related_obj._meta.model_name,
                                    related_obj.pk,
                                    using,
                                )
            except Exception as e:
                # Log the error or handle as needed
                print(f"Error handling relation {related_name}: {str(e)}")
                continue

    # Finally, soft delete the instance itself if it hasn't been deleted yet
    if hasattr(instance, "deleted_at") and not instance.deleted_at:
        instance.deleted_at = timezone.now()
        instance.save()


def purge_issues(issues):
    """Hard delete soft-deleted issues with their deleted sub-items.

    Activities reference issues without a database cascade, so they go first.
    Live sub-items of a purged issue are detached instead of deleted.
    """
    from plane.db.models import Issue, IssueActivity

    ids = set(issues.filter(deleted_at__isnull=False).values_list("id", flat=True))
    frontier = ids
    while frontier:
        frontier = (
            set(Issue.all_objects.filter(parent_id__in=frontier, deleted_at__isnull=False).values_list("id", flat=True))
            - ids
        )
        ids |= frontier
    with transaction.atomic():
        Issue.objects.filter(parent_id__in=ids).update(parent=None)
        IssueActivity.all_objects.filter(issue_id__in=ids).delete()
        Issue.all_objects.filter(id__in=ids).delete()


def restore_related_objects(instance, since):
    """Restore the rows that the soft delete cascade of instance removed.

    The cascade stamps rows at or after ``since``, the instance's own
    ``deleted_at``. Older rows were deleted on their own and stay deleted. A row
    only comes back when every soft-deletable row it points to exists.
    """
    for relation in _cascading_relations(instance):
        if not hasattr(relation.related_model, "all_objects"):
            continue
        rows = relation.related_model.all_objects.filter(
            **{relation.remote_field.name: instance.pk, "deleted_at__gte": since}
        )
        for row in rows:
            if not _targets_exist(row):
                continue
            if not undelete(row):
                continue
            restore_related_objects(row, since)


def undelete(row, **changes):
    """Clear deleted_at on row. False if a live row now takes its unique slot."""
    changes["deleted_at"] = None
    if any(field.name == "updated_at" for field in row._meta.concrete_fields):
        changes["updated_at"] = timezone.now()
    try:
        with transaction.atomic():
            type(row).all_objects.filter(pk=row.pk).update(**changes)
    except IntegrityError:
        return False
    return True


def _cascading_relations(instance):
    return [
        f
        for f in instance._meta.get_fields()
        if (f.one_to_many or f.one_to_one)
        and f.auto_created
        and not f.concrete
        and getattr(f.on_delete, "__name__", "") not in ("DO_NOTHING", "RESTRICT", "SET_NULL")
    ]


def _targets_exist(row):
    for field in row._meta.concrete_fields:
        if field.name in ("created_by", "updated_by"):
            continue
        target = field.related_model if field.is_relation else None
        value = getattr(row, field.attname) if target else None
        if value is None or not hasattr(target, "all_objects"):
            continue
        if target.all_objects.filter(pk=value, deleted_at__isnull=False).exists():
            return False
    return True


@shared_task
def hard_delete():
    from plane.db.models import (
        Workspace,
        Project,
        Cycle,
        Module,
        Issue,
        Page,
        IssueView,
        Label,
        State,
        IssueActivity,
        IssueComment,
        IssueLink,
        IssueReaction,
        UserFavorite,
        ModuleIssue,
        CycleIssue,
        Estimate,
        EstimatePoint,
    )

    days = settings.HARD_DELETE_AFTER_DAYS
    # check delete workspace
    _ = Workspace.all_objects.filter(deleted_at__lt=timezone.now() - timezone.timedelta(days=days)).delete()

    # check delete project
    _ = Project.all_objects.filter(deleted_at__lt=timezone.now() - timezone.timedelta(days=days)).delete()

    # check delete cycle
    _ = Cycle.all_objects.filter(deleted_at__lt=timezone.now() - timezone.timedelta(days=days)).delete()

    # check delete module
    _ = Module.all_objects.filter(deleted_at__lt=timezone.now() - timezone.timedelta(days=days)).delete()

    # check delete issue
    purge_issues(Issue.all_objects.filter(deleted_at__lt=timezone.now() - timezone.timedelta(days=days)))

    # check delete page
    _ = Page.all_objects.filter(deleted_at__lt=timezone.now() - timezone.timedelta(days=days)).delete()

    # check delete view
    _ = IssueView.all_objects.filter(deleted_at__lt=timezone.now() - timezone.timedelta(days=days)).delete()

    # check delete label
    _ = Label.all_objects.filter(deleted_at__lt=timezone.now() - timezone.timedelta(days=days)).delete()

    # check delete state
    _ = State.all_objects.filter(deleted_at__lt=timezone.now() - timezone.timedelta(days=days)).delete()

    _ = IssueActivity.all_objects.filter(deleted_at__lt=timezone.now() - timezone.timedelta(days=days)).delete()

    old_comments = IssueComment.all_objects.filter(deleted_at__lt=timezone.now() - timezone.timedelta(days=days))
    IssueActivity.all_objects.filter(issue_comment__in=old_comments).update(issue_comment=None)
    _ = old_comments.delete()

    _ = IssueLink.all_objects.filter(deleted_at__lt=timezone.now() - timezone.timedelta(days=days)).delete()

    _ = IssueReaction.all_objects.filter(deleted_at__lt=timezone.now() - timezone.timedelta(days=days)).delete()

    _ = UserFavorite.all_objects.filter(deleted_at__lt=timezone.now() - timezone.timedelta(days=days)).delete()

    _ = ModuleIssue.all_objects.filter(deleted_at__lt=timezone.now() - timezone.timedelta(days=days)).delete()

    _ = CycleIssue.all_objects.filter(deleted_at__lt=timezone.now() - timezone.timedelta(days=days)).delete()

    _ = Estimate.all_objects.filter(deleted_at__lt=timezone.now() - timezone.timedelta(days=days)).delete()

    _ = EstimatePoint.all_objects.filter(deleted_at__lt=timezone.now() - timezone.timedelta(days=days)).delete()

    # at last, check for every thing which ever is left and delete it
    # Get all Django models
    all_models = apps.get_models()

    # Iterate through all models
    for model in all_models:
        # Soft-deletable models only. User has a deleted_at of its own for merged accounts.
        if hasattr(model, "all_objects"):
            # Get all instances where 'deleted_at' is greater than 30 days ago
            _ = model.all_objects.filter(deleted_at__lt=timezone.now() - timezone.timedelta(days=days)).delete()

    return
