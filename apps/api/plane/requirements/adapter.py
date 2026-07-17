# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""strictdoc <-> Plane adapter.

Isolated bridge over strictdoc's library API. Two jobs:
  - read_requirements(repo_dir): parse a checkout into flat projection nodes.
  - render_document(repo_dir, ...): edit fields of requirements and return the
    .sdoc text with a minimal diff (not written to disk here).

strictdoc is imported lazily inside the functions so importing this module does
not pull the (heavy) dependency at Django startup; only the sync worker touches
it.

MID handling: the requirements repos declare ENABLE_MID: True but persist no
MID: lines and key everything on UID. strictdoc auto-generates a random MID per
node on read, which would churn every write. We strip those auto-generated MID
lines on write so the round-trip stays byte-clean and the files keep their
authored form.
"""

from __future__ import annotations

import dataclasses
import os
import re
import shutil
import tempfile

# MID: <32 hex> lines that strictdoc injects for un-persisted nodes.
_MID_LINE = re.compile(r"^MID: [0-9a-f]{32}\n", re.MULTILINE)

_DENORMALIZED = {"UID", "TITLE", "STATEMENT"}


@dataclasses.dataclass(frozen=True, kw_only=True, slots=True)
class RequirementNode:
    uid: str
    node_type: str
    file_path: str
    title: str | None
    statement: str | None
    field_values: dict
    relations: list
    sort_order: int
    document_title: str | None


def _load(repo_dir: str):
    from strictdoc.core.project_config import ProjectConfigLoader
    from strictdoc.core.traceability_index_builder import TraceabilityIndexBuilder
    from strictdoc.helpers.parallelizer import Parallelizer

    cfg = ProjectConfigLoader.load_from_path_or_get_default(path_to_config=repo_dir)
    cfg.input_paths = [repo_dir]
    # strictdoc writes a parse cache to output/_cache relative to the process
    # CWD by default. Redirect it to a throwaway dir so we never pollute the
    # working tree; the cache is only used while the index is being built.
    cache_dir = tempfile.mkdtemp(prefix="plane-sdoc-cache-")
    cfg.dir_for_sdoc_cache = os.path.join(cache_dir, "_cache")
    par = Parallelizer.create(False)
    try:
        index = TraceabilityIndexBuilder.create(
            project_config=cfg, parallelizer=par, skip_source_files=True
        )
    finally:
        par.shutdown()
        shutil.rmtree(cache_dir, ignore_errors=True)
    return cfg, index


def _rel_path(doc) -> str:
    return doc.meta.input_doc_rel_path.relative_path


def _field_value(field) -> str:
    if not field.parts:
        return ""
    return "".join(p if isinstance(p, str) else str(p) for p in field.parts)


def _apply_fields(node, fields: dict[str, str]) -> None:
    """Set/add/remove fields via strictdoc's canonical API.

    set_field_value keeps the node's ordered field lookup consistent (a raw
    node.fields append does not serialize) and inserts new fields at the
    grammar position. A field absent from the grammar raises ValueError; we
    re-raise it with a clearer message so the API can surface it.
    """
    for field_name, value in fields.items():
        try:
            node.set_field_value(field_name=field_name, form_field_index=0, value=value)
        except ValueError:
            raise ValueError(f"Field '{field_name}' is not defined in the document grammar")


# Fields that describe a specific requirement and must not be inherited when a
# new node is cloned from an existing one as a template.
_INSTANCE_FIELDS = ("COMMENT", "JIRA", "APPLIES_TO", "REG_REF", "PAPERPLANE")


def read_requirements(repo_dir: str) -> list[RequirementNode]:
    """Parse every .sdoc under repo_dir into flat requirement projection nodes."""
    _cfg, index = _load(repo_dir)
    out: list[RequirementNode] = []
    for doc in index.document_tree.document_list:
        rel = _rel_path(doc)
        order = 0
        for node in doc.iterate_nodes():
            if node.node_type != "REQUIREMENT":
                continue
            fields = {f.field_name: _field_value(f) for f in node.fields}
            out.append(
                RequirementNode(
                    uid=fields.get("UID", ""),
                    node_type=node.node_type,
                    file_path=rel,
                    title=fields.get("TITLE"),
                    statement=fields.get("STATEMENT"),
                    field_values={
                        k: v for k, v in fields.items() if k not in _DENORMALIZED
                    },
                    relations=[
                        {"type": r.ref_type, "value": r.ref_uid} for r in node.relations
                    ],
                    sort_order=order,
                    document_title=doc.title,
                )
            )
            order += 1
    return out


def render_document(
    repo_dir: str,
    file_path: str,
    edits: dict[str, dict[str, str]],
    relations: dict[str, list[dict]] | None = None,
) -> str | None:
    """Return the .sdoc text for file_path with edits applied.

    edits maps {uid: {field_name: new_value}} (existing fields only). relations
    maps {uid: [{"type": "Parent"|"Child", "value": uid}]} and REPLACES that
    node's relations. Returns None if the document is not found.
    """
    from strictdoc.backend.sdoc.models.reference import ChildReqReference, ParentReqReference
    from strictdoc.backend.sdoc.writer import SDWriter

    relations = relations or {}
    cfg, index = _load(repo_dir)
    target = next(
        (d for d in index.document_tree.document_list if _rel_path(d) == file_path),
        None,
    )
    if target is None:
        return None

    for node in target.iterate_nodes():
        if node.node_type != "REQUIREMENT":
            continue
        uid = next((_field_value(f) for f in node.fields if f.field_name == "UID"), None)
        if uid in edits:
            _apply_fields(node, edits[uid])
        if uid in relations:
            refs = []
            for rel in relations[uid]:
                value = rel.get("value")
                if not value:
                    continue
                ref_cls = ChildReqReference if rel.get("type") == "Child" else ParentReqReference
                refs.append(ref_cls(parent=node, ref_uid=value, role=None))
            node.relations = refs

    text = SDWriter(cfg).write(target)
    return _MID_LINE.sub("", text)


def add_requirement(
    repo_dir: str,
    file_path: str,
    uid: str,
    title: str,
    statement: str,
    fields: dict[str, str] | None = None,
) -> str | None:
    """Append a new requirement to file_path and return the .sdoc text.

    The node is cloned from the last requirement in the document so it inherits
    the document's exact grammar and field shape, then its identity and provided
    fields are overwritten. Returns None if the document is not found.
    """
    import copy

    from strictdoc.backend.sdoc.writer import SDWriter

    cfg, index = _load(repo_dir)
    target = next(
        (d for d in index.document_tree.document_list if _rel_path(d) == file_path),
        None,
    )
    if target is None:
        return None
    templates = [n for n in target.iterate_nodes() if n.node_type == "REQUIREMENT"]
    if not templates:
        raise ValueError("Cannot add a requirement to a document with no requirements")

    template = templates[-1]
    node = copy.deepcopy(template)
    node.parent = template.parent
    node.relations = []
    # Drop template-specific fields. set_field_value(None) refuses to delete
    # COMMENT, so pop straight from the ordered lookup the writer reads from.
    for name in _INSTANCE_FIELDS:
        node.ordered_fields_lookup.pop(name, None)
    node.set_field_value(field_name="UID", form_field_index=0, value=uid)
    node.set_field_value(field_name="TITLE", form_field_index=0, value=title)
    node.set_field_value(field_name="STATEMENT", form_field_index=0, value=statement or "")
    _apply_fields(node, fields or {})
    template.parent.section_contents.append(node)

    return _MID_LINE.sub("", SDWriter(cfg).write(target))
