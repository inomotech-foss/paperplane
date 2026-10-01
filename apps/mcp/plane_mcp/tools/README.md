# The tool surface

**19 tools**, one per Plane resource, each taking an `action` parameter that selects the operation. 113 actions in total.

```python
workitem(action="create", project_id=..., name="Fix login")
workitem(action="list", project_id=..., pql='state_group = "started"')
cycle(action="archive", project_id=..., cycle_id=...)
```

Upstream advertises 30 tools. This fork vendors only the resources its API serves: customers, initiatives, milestones, releases, work logs, templates and collections are left out, and the kept tools drop the actions (workspace features, worklog summaries, workspace pages, page archiving, relation definitions, multi-type property attachment) that have no endpoint here.

Five parts, in this order:

```python
NAME = "label"                       # 1. identity
TITLE = "Labels"

ACTIONS = (                          # 2. the declaration -- single source of truth
    Action("list", ("project_id",), ("cursor", "per_page"), read=True),
    Action("create", ("project_id", "name"), ("color", "description")),
    Action("delete", ("project_id", "label_id"), destructive=True),
)

FOOTER = "color is a hex code such as #EF4444."   # 3. cross-cutting notes
LEGACY = {"list_labels": "list", ...}             # 4. retired name -> action

def register(mcp):                                # 5. dispatch
    @mcp.tool(
        name=NAME,
        description=build_description("Labels within a project.", ACTIONS, FOOTER),
        annotations=build_annotations(TITLE, ACTIONS),
    )
    def label(action: Literal["list", "create", "delete"], project_id: str = "", ...):
        ...
```

`ACTIONS` generates the description, the MCP annotations *and* argument validation, so documentation cannot drift from behaviour. Add the module, add one entry to `registry.py`, done.

## Conventions

| Rule | Why |
|---|---|
| Parameters are plain typed defaults (`= ""`, `= 0`) | `X \| None` renders a verbose `anyOf`-with-null block. Use `bool \| None` only where `False`/`0` is a real value distinct from unset — and say so in a comment |
| Validate enums with `one_of()` | They are `str` in the schema; an unchecked value is dropped from the payload and the write reports success |
| Declare every parameter an action takes, and only those | `ValidateActionArguments` checks calls against it. `query` is a real `workitem` parameter but useless to `count` — sent there it used to validate cleanly and answer a different question |
| Use `needs()` for multi-parameter guards | It names only what is absent. `if not a or not b` blames both, so a caller that supplied `a` is told to send it again |
| An action accepting `cursor` must return `envelope(response)` | Returning `response.results` lets a caller page in but never page on |
| Match the SDK's `params` type: `page_params` vs `as_params` | Some endpoints take a `Mapping`, others a Pydantic model they call `.model_dump()` on. The wrong one raises at call time |
| Declare the type you mean | `CoerceArguments` repairs `'["uuid"]'` before validation, so type a list as a list. `coerce_list` is for parameters genuinely declared `str`, where a comma separates |
| The surface spells it `workitem`; `plane-sdk` spells it `work_item` | Tool names, actions and parameters use `workitem`; SDK namespaces, kwargs and PQL fields keep `work_item`. `test_vocabulary.py` pins both directions |

## Layout

| Path | Contents |
|---|---|
| `<resource>.py` | one module per resource |
| `registry.py` | `RESOURCES` in advertised order, plus the alias tables |
| `legacy.py` | `LegacyNames` — resolves retired tool names |
| `../toolkit/` | shared helpers — see [`../toolkit/README.md`](../toolkit/README.md) |

`RESOURCES` is an explicit tuple, not a directory scan. Its order is the advertised order and therefore a wire-format guarantee: tool definitions head a client's prompt cache, so reordering invalidates live conversations. `test_resource_order_is_pinned` holds it to a literal list.

## Retired tool names

Before consolidation this server exposed 106 tools, one per API operation. **103 still resolve**, unadvertised — so they cost nothing in the listing, but a saved prompt calling `create_work_item` keeps working, including the parameter names it shipped with (`work_item_id`, not `workitem_id`). Every resolution is logged, so the remaining callers are an observation rather than a guess.

**3 cannot be mapped.** An alias renames a tool; it cannot reshape one, and these chose between two operations with a parameter (`manage_project_archive(archive=False)`). Each is declared in its module's `LEGACY_UNMAPPED` with the replacement to use.

`tests/tools/_retired_names.py` is the frozen record of all 106; the conformance suite asserts every one is aliased, declared unmappable, or still registered.

## Scope: project vs workspace

Work item types and properties exist at the workspace as well as the project. The idiom a model sees is uniform: **supply `project_id` for the project's own set, omit it for the workspace's.** Each resource resolves scope once, at the top of its dispatch, and `test_governance.py` pins the namespaces and id keywords against the live SDK.

Types belong to the workspace here and are linked into projects, so `workitem_type resolve` finds the type in the project, else finds or creates it at the workspace and imports it.

## Tools

| Tool | Actions |
|---|---|
| `cycle` | `list` · `retrieve` · `create` · `update` · `delete` · `list_workitems` · `manage_workitems` · `transfer_workitems` · `complete` · `archive` · `unarchive` |
| `get_pql_reference` | *(no action parameter)* |
| `intake` | `list` · `retrieve` · `create` · `update` · `delete` |
| `label` | `list` · `retrieve` · `create` · `update` · `delete` |
| `member` | `me` · `list_workspace` · `list_project` |
| `module` | `list` · `retrieve` · `create` · `update` · `delete` · `list_workitems` · `manage_workitems` · `archive` · `unarchive` |
| `page` | `list` · `retrieve` · `create` |
| `project` | `list` · `retrieve` · `create` · `update` · `delete` · `archive` · `unarchive` · `get_features` · `update_features` |
| `project_estimate` | `retrieve` · `create` · `update` · `delete` · `link` · `list_points` · `create_points` · `update_point` · `delete_point` |
| `state` | `list` · `retrieve` · `create` · `update` · `delete` |
| `workitem` | `list` · `list_archived` · `retrieve` · `retrieve_by_identifier` · `search` · `count` · `create` · `update` · `delete` · `archive` · `manage_assignee` · `manage_label` |
| `workitem_activity` | `list` · `retrieve` |
| `workitem_attachment` | `list` · `read` · `download_url` · `upload_from_url` · `delete` |
| `workitem_comment` | `list` · `retrieve` · `create` · `update` · `delete` |
| `workitem_link` | `list` · `retrieve` · `create` · `update` · `delete` |
| `workitem_property` | `list` · `retrieve` · `create` · `update` · `delete` · `list_options` · `retrieve_option` · `create_option` · `update_option` · `delete_option` · `get_value` · `set_value` · `delete_value` |
| `workitem_relation` | `list` · `create` · `delete` |
| `workitem_type` | `list` · `retrieve` · `resolve` · `create` · `update` · `delete` · `import_to_project` |
| `workspace` | *(no action parameter)* |

Every tool's own description lists its actions with their required and optional
parameters; that description is generated from `ACTIONS` and is the authoritative
reference at call time.

## Epics

There are no epic tools. An epic is a work item whose type is named "Epic":

1. `workitem_type resolve` with `project_id` and `name="Epic"` → `id` is the `type_id`.
2. `workitem create` with that `type_id`.
3. `workitem list` with `pql='type = "<type id>"'`.

## Tests

```bash
pytest tests/tools -q        # no network, no credentials
```

Every action of every resource runs against `SpyClient`, a stand-in that binds
each call against the genuine `plane-sdk` signature and type-checks the
arguments. Payload-shape mistakes a plain mock would accept — a flat body where
the SDK wants a nested model, a dict where it wants a Pydantic object — are
caught here rather than at runtime.

| File | Guarantees |
|---|---|
| `test_conformance.py` | Surface-wide invariants: tool count, listing size, strict-mode schemas, annotations derived from `ACTIONS`, catalogue order pinned, every retired name accounted for |
| `test_dispatch.py` | Every action reaches the SDK with well-typed arguments; called bare, it names what is missing instead of issuing a request |
| `test_guards.py` | Omitting one declared required parameter names *that* parameter and no other |
| `test_pagination.py` | An action declaring `cursor` returns a `next_cursor`; an unpaginated endpoint does not advertise one |
| `test_vocabulary.py` | `workitem` everywhere a model reads; `work_item` preserved in SDK calls and retired names |
| `test_references.py` | Every backticked `tool action` in a description, in the server instructions, and in the PQL reference resolves |
| `test_governance.py` | Project-vs-workspace scope pinned to its namespace and id keyword |
| `test_workitem_property.py` | Values reach the SDK in the type the property expects; malformed option JSON and absent scopes are reported, not swallowed |
| `test_attachments.py` | The image-versus-text return channel, size limits, and the SSRF guard |
