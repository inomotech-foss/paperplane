# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Turns Plane rows into PaperPlane model instances and writes them.

The PaperPlane model decides what is written. Each concrete field takes the
source column of the same name when the row has one and its model default
when it does not, so a column added or dropped on either side needs no code.
A column whose meaning changed gets a converter on its entity.
"""

import re
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from itertools import islice

from django.db import models

from plane.db.management.commands.sanitize_stored_html import TARGETS, HtmlField
from plane.db.models import Module, Project, Sticky, Workspace
from plane.utils.content_validator import validate_html_content
from plane.utils.html_processor import strip_tags

BATCH_SIZE = 500

MISSING_PARENT = "missing parent"
ID_TAKEN = "id already used in the target"
OUTSIDE_SELECTION = "outside selection"

_TEXT_FIELDS = (models.TextField, models.CharField, models.JSONField)

# The user HTML that `sanitize_stored_html` cleans, by model, plus the HTML
# an import also brings in that the app never sanitized at rest.
_HTML_FIELDS = {target.model: target for target in TARGETS.values() if isinstance(target, HtmlField)}
_HTML_FIELDS.update(
    {
        Sticky: HtmlField(Sticky),
        Project: HtmlField(Project, stripped=None),
        Module: HtmlField(Module, stripped=None),
    }
)


@dataclass
class Context:
    ids: object
    report: object
    web_url: str = ""
    workspaces: object = None
    allow_existing: bool = False
    state: dict = field(default_factory=dict)
    # (model, field) -> [(pk, source id)] for FKs set once their target is loaded
    pending: defaultdict = field(default_factory=lambda: defaultdict(list))
    # (report counter, source id) noted while a batch is built, counted once it is written
    notes: list = field(default_factory=list)

    def note(self, counter, row):
        self.notes.append((counter, row.get("id")))


@dataclass
class Entity:
    """One PaperPlane model filled from the Plane table of the same name.

    ``convert`` maps a field's attname to ``fn(row, ctx)``. ``skip`` names
    fields never read from the source. ``keep(row, ctx)`` returns True to
    import a row or the reason it is left out. ``after(ctx)`` runs once the
    entity's rows are written.
    """

    model: type
    convert: dict = field(default_factory=dict)
    skip: tuple = ()
    keep: object = None
    after: object = None
    table: str = None

    def __post_init__(self):
        self.table = self.table or self.model._meta.db_table


def load(entity, source, ctx):
    """Write every source row of `entity`; returns how many were written."""
    model = entity.model
    rewrite = _rewriter(ctx.ids.remapped())
    written = 0
    rows = source.rows(entity.table)
    while batch := list(islice(rows, BATCH_SIZE)):
        objs = [obj for obj in (_build(entity, row, ctx, rewrite) for row in batch) if obj is not None]
        objs = _unclaimed(entity, objs, ctx)
        _sanitize(entity, objs, ctx)
        _write(model, objs, entity.skip)
        for obj in objs:
            ctx.ids.add(model, obj.pk)
        written += len(objs)
        _count_notes(ctx, {obj.pk for obj in objs})

    ctx.ids.mark_loaded(model)
    ctx.report.written[entity.table] = ctx.report.written.get(entity.table, 0) + written
    resolve_pending(ctx, model)
    if entity.after is not None:
        entity.after(ctx)
    return written


def _build(entity, row, ctx, rewrite):
    model, table = entity.model, entity.table
    if entity.keep is not None:
        verdict = entity.keep(row, ctx)
        if verdict is not True:
            _drop(ctx, model, table, row, verdict or "skipped")
            return None

    values, deferred = {}, []
    for f in model._meta.concrete_fields:
        name = f.attname
        if name in entity.skip:
            continue
        if name in entity.convert:
            values[name] = entity.convert[name](row, ctx)
            continue
        value = row.get(name)
        if value is None and not f.null and f.is_relation:
            _drop(ctx, model, table, row, MISSING_PARENT)
            return None
        if name not in row or (value is None and not f.null):
            # A NULL Plane allows where PaperPlane does not takes the default too.
            continue
        if not f.is_relation or value is None:
            if rewrite and isinstance(f, _TEXT_FIELDS):
                value = rewrite(value)
            elif rewrite and isinstance(f, models.UUIDField) and value is not None:
                # Ids kept outside FKs, like an activity's old and new assignee.
                value = uuid.UUID(rewrite(str(value)))
            values[name] = value
            continue

        related = f.related_model
        if f.null and (related is model or not ctx.ids.loaded(related)):
            deferred.append((f, value))
            continue
        target = ctx.ids.get(related, value)
        if target is not None:
            values[name] = target
        elif ctx.ids.is_excluded(related, value) and not f.null:
            _drop(ctx, model, table, row, OUTSIDE_SELECTION)
            return None
        elif f.null:
            values[name] = None
            ctx.report.nulled[f"{table}.{name}"] += 1
        else:
            _drop(ctx, model, table, row, MISSING_PARENT)
            return None

    obj = model(**values)
    for f, value in deferred:
        ctx.pending[(model, f)].append((obj.pk, value))
    return obj


def _sanitize(entity, objs, ctx):
    """Clean imported HTML the way PaperPlane cleans what users save.

    Plane's sanitizer is not PaperPlane's, so a body it stored can still carry
    markup PaperPlane would refuse. The editor's binary copy is never taken
    from the source, since it can hold what the HTML does not: it is cleared,
    and the live server rebuilds it from the clean HTML.
    """
    target = _HTML_FIELDS.get(entity.model)
    if target is None:
        return
    has_binary = any(f.attname == "description_binary" for f in entity.model._meta.concrete_fields)
    for obj in objs:
        if has_binary:
            obj.description_binary = None
        html = getattr(obj, target.html)
        if not html or not isinstance(html, str):
            continue
        is_valid, _, clean = validate_html_content(html)
        if not is_valid:
            clean = "<p></p>"
            ctx.report.html_rejected[entity.table] += 1
        if clean == html:
            continue
        setattr(obj, target.html, clean)
        if target.stripped:
            setattr(obj, target.stripped, strip_tags(clean) if clean else target.empty_stripped)
        if is_valid:
            ctx.report.sanitized[entity.table] += 1


def _count_notes(ctx, written):
    """A converter's count only stands for a row that was written in the end."""
    for counter, source_id in ctx.notes:
        if source_id is not None and _as_uuid(source_id) in written:
            setattr(ctx.report, counter, getattr(ctx.report, counter) + 1)
    ctx.notes.clear()


def _as_uuid(value):
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


def _unclaimed(entity, objs, ctx):
    """The rows whose id is free in the target, or already belongs to this import.

    The upsert keys on id, so a source row must never land on a target row it
    does not own: another user's account, or a row of another workspace. An
    existing row is only updated on a re-run (``allow_existing``) and only when
    it sits in the same workspace; anything else is left out and counted.
    """
    model = entity.model
    scoped = "workspace_id" in {f.attname for f in model._meta.concrete_fields}
    # A workspace is the same one only under the same slug, which the preflight
    # checked; any other row belongs to the workspace it sits in.
    owner = "slug" if model is Workspace else "workspace_id" if scoped else None
    if owner is None:
        taken = set(model._base_manager.filter(pk__in=[obj.pk for obj in objs]).values_list("pk", flat=True))
        existing = dict.fromkeys(taken)
    else:
        existing = dict(model._base_manager.filter(pk__in=[obj.pk for obj in objs]).values_list("pk", owner))

    free = []
    for obj in objs:
        if obj.pk not in existing:
            free.append(obj)
            continue
        current = existing[obj.pk]
        ours = owner is not None and current is not None and current == getattr(obj, owner)
        if ctx.allow_existing and ours:
            free.append(obj)
        else:
            ctx.report.dropped[entity.table][ID_TAKEN] += 1
    return free


def _drop(ctx, model, table, row, reason):
    ctx.report.dropped[table][reason] += 1
    if reason == OUTSIDE_SELECTION and row.get("id") is not None:
        # What hangs off a row outside the selection is outside it too.
        ctx.ids.exclude(model, row["id"])


def _write(model, objs, skip=()):
    """Upsert on id, then put back the dates ``auto_now`` overwrote on the way in."""
    if not objs:
        return
    stamps = [
        f for f in model._meta.concrete_fields if getattr(f, "auto_now", False) or getattr(f, "auto_now_add", False)
    ]
    kept = [[getattr(obj, f.attname) for f in stamps] for obj in objs]
    # A skipped field keeps whatever the target holds when the row already exists.
    updatable = [f.name for f in model._meta.concrete_fields if not f.primary_key and f.attname not in skip]
    model._base_manager.bulk_create(
        objs, batch_size=BATCH_SIZE, update_conflicts=True, unique_fields=["id"], update_fields=updatable
    )
    restore = []
    for obj, values in zip(objs, kept):
        for f, value in zip(stamps, values):
            if value is not None:
                setattr(obj, f.attname, value)
        restore.append(obj)
    if stamps:
        model._base_manager.bulk_update(restore, [f.name for f in stamps], batch_size=BATCH_SIZE)


def resolve_pending(ctx, loaded=None):
    """Set the deferred FKs that point at `loaded`, or every one left when `loaded` is None."""
    for (model, f), items in list(ctx.pending.items()):
        if loaded is not None and f.related_model is not loaded:
            continue
        del ctx.pending[(model, f)]
        updates = []
        for pk, value in items:
            target = ctx.ids.get(f.related_model, value)
            if target is None:
                ctx.report.nulled[f"{model._meta.db_table}.{f.attname}"] += 1
            elif ctx.ids.get(model, pk) is not None:
                updates.append(model(pk=pk, **{f.attname: target}))
        if updates:
            model._base_manager.bulk_update(updates, [f.name], batch_size=BATCH_SIZE)


def _rewriter(remapped):
    """Replaces the ids of matched rows inside text and JSON values."""
    if not remapped:
        return None
    pattern = re.compile("|".join(map(re.escape, remapped)))

    def rewrite(value):
        if isinstance(value, str):
            return pattern.sub(lambda match: remapped[match.group(0)], value)
        if isinstance(value, list):
            return [rewrite(item) for item in value]
        if isinstance(value, dict):
            return {rewrite(key): rewrite(item) for key, item in value.items()}
        return value

    return rewrite
