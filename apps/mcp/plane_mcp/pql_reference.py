# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.
"""The Plane Query Language this fork's API parses (apps/api/plane/utils/pql).

Upstream ships a reference for Plane Cloud's dialect; the grammar here differs
(field names, `now() - 7d`, `descendantOf()`, names in place of ids), so the
text is written against the local parser instead.
"""

# One-line hint on the `pql` parameter of every list that takes one.
_FIELD_HINT_TEMPLATE = (
    "Optional Plane Query Language (PQL) filter. Examples: "
    '`priority = "urgent" AND assignee = currentUser()`, '
    '`type = "Invoice" AND state = "Paid"`, `descendantOf("CUST-1")`. '
    'Names resolve to ids on the server (`type = "Epic"`, `cf["Amount"] > 1000`); '
    "resolve a UUID with {projects}, {members} or {types} only when a name is ambiguous. "
    "Call `get_pql_reference` for the full syntax before composing complex queries."
)

# Compact reference returned by `get_pql_reference(detail="brief")`.
PQL_FIELD_DESCRIPTION = """\
Plane Query Language (PQL) filter string for work items. Output ONLY valid PQL.

FIELDS (a name or a UUID; names match case-insensitively within the project)
  state (alias status)     "Paid" or a state UUID
  state_group              "backlog" | "unstarted" | "started" | "completed" | "cancelled"
  priority                 "urgent" | "high" | "medium" | "low" | "none"
  project                  "SALES" (identifier), a name, or a project UUID
  type                     "Invoice" or a type UUID
  label / labels           a label name or UUID
  assignee / assignees     an email, display name, UUID, or currentUser()
  module, cycle            a name or UUID
  created_by               a member UUID or currentUser()
  parent                   "PROJ-12" (identifier) or a UUID; direct children only
  ancestor                 "PROJ-12" or a UUID; every level below
  name (alias title)       text, use ~
  target_date (alias due_date), start_date      dates
  created_at, updated_at, completed_at          compared on their calendar day

CUSTOM PROPERTIES  cf["<property name or id>"]
  cf["Amount"] > 1000          cf["Tier"] = "Gold"          cf["Due date"] >= "2026-01-01"
  OPTION takes an option name or id; DECIMAL a bare number; BOOLEAN bare true/false;
  a bare date on a DATETIME property means the whole day.

OPERATORS
  =  !=  in (...)  not in (...)  is null  is not null      on every field
  >  >=  <  <=                                             dates, timestamps, decimal properties
  ~  (case-insensitive contains)                           name, text properties
  AND  OR  NOT  and parentheses
  Reserved words: and or not in is null cf currentUser now childOf descendantOf.
  Quote one ("now") to use it as a value.

FUNCTIONS
  currentUser()                    the caller
  now(), now() - 7d, now() + 2w    offsets in h (hours), d (days), w (weeks)
  childOf("PROJ-12")               direct children of a work item
  descendantOf("PROJ-12")          everything below it, at any depth

EXAMPLES
  priority = "urgent" AND assignee = currentUser()
  type = "Invoice" AND state = "Paid"
  state_group in ("started", "backlog")
  descendantOf("CUST-1") AND type = "Invoice"
  target_date >= now() - 7d AND target_date < now()
  cf["Amount"] > 1000 AND cf["Due date"] < "2027-01-01"
  name ~ "login" AND NOT state_group = "completed"
"""

# Returned when a `pql` filter is refused, so the retry can be self-corrected.
_FULL_REFERENCE_TEMPLATE = """\
## PQL (Plane Query Language) Reference

Every field takes a name or a UUID. A name is matched case-insensitively within the
projects the caller can see; a name shared by several rows matches all of them, and an
unknown name is refused with the field named.

### Fields

| Field | Aliases | Values |
|---|---|---|
| state | status | state name or UUID |
| state_group | | backlog, unstarted, started, completed, cancelled |
| priority | | urgent, high, medium, low, none |
| project | | project identifier (SALES), name or UUID |
| type | | work item type name or UUID |
| labels | label | label name or UUID |
| assignees | assignee | email, display name, UUID or currentUser() |
| module | | module name or UUID |
| cycle | | cycle name or UUID |
| created_by | | member UUID or currentUser() |
| parent | | work item identifier (PROJ-12) or UUID; direct children |
| ancestor | | work item identifier or UUID; every level below |
| name | title | text, filter with ~ |
| target_date | due_date | YYYY-MM-DD or now() offset |
| start_date | | YYYY-MM-DD or now() offset |
| created_at, updated_at, completed_at | | compared on their calendar day |

### Custom properties

`cf["<property name or id>"]` addresses a custom property; {properties} lists them with
their ids and option ids, but the display name works as well.

| Property type | Operators | Value |
|---|---|---|
| TEXT, URL, EMAIL | =, !=, ~, in, is null | quoted string |
| OPTION | =, !=, in, not in, is null | option name or id |
| RELATION | =, !=, in, not in, is null | record UUID |
| DECIMAL | =, !=, >, >=, <, <=, is null | bare number |
| DATETIME | =, !=, >, >=, <, <=, is null | "YYYY-MM-DD" (the whole day) or now() offset |
| BOOLEAN | =, is null | bare true or false |

### Operators

`=`, `!=`, `in (...)`, `not in (...)`, `is null` and `is not null` work on every field.
`>`, `>=`, `<`, `<=` work on dates, timestamps and decimal properties. `~` is a
case-insensitive contains on name and text properties. Combine with `AND`, `OR`, `NOT`
and parentheses.

### Functions

```
currentUser()              the caller
now()                      now; now() - 7d, now() + 12h, now() - 2w (h, d, w)
childOf("PROJ-12")         direct children of that work item
descendantOf("PROJ-12")    every work item below it, at any depth
```

The function names, `cf` and the keywords `and`, `or`, `not`, `in`, `is` and `null`
are reserved words: quote them (`"now"`) to use them as values. `childOf` and
`descendantOf` take a work item identifier such as PROJ-12 or a UUID, never a title. `parent = "PROJ-12"` and `ancestor = "PROJ-12"` are the same filters as
fields.

### Resolving a UUID

Only needed when a name is ambiguous or refused:
  project  -> {projects}    assignee, created_by -> {members}
  state    -> {states}      label -> {labels}      type -> {types}
  cycle    -> {cycles}      module -> {modules}    custom property -> {properties}

### Not supported

Milestones and releases do not exist on this edition. History queries (wasEver,
changedFrom, commentedBy and the like) are not available.

### Examples

```pql
priority = "urgent" AND assignee = currentUser()
type = "Invoice" AND state = "Paid"
state_group in ("started", "backlog")
childOf("PROJ-12")
descendantOf("CUST-1") AND type = "Invoice" AND state = "Paid"
target_date >= now() - 7d AND target_date < now()
created_at >= "2026-01-01"
cf["Amount"] > 1000
cf["Due date"] >= "2026-01-01" AND cf["Due date"] < "2027-01-01"
name ~ "login" AND NOT state_group = "completed"
```
"""


# The reference tells a model which tool resolves a name to an id, so every
# pointer is substituted here and `test_references.py` follows each one.
RESOLVERS = {
    "projects": "`project list`",
    "members": "`member list_workspace`",
    "states": "`state list`",
    "labels": "`label list`",
    "types": "`workitem_type list`",
    "cycles": "`cycle list`",
    "modules": "`module list`",
    "properties": "`workitem_property list`",
}


def render(template: str, resolvers: dict[str, str]) -> str:
    for key, name in resolvers.items():
        template = template.replace("{" + key + "}", name)
    return template


PQL_FIELD_HINT = render(_FIELD_HINT_TEMPLATE, RESOLVERS)
PQL_FULL_REFERENCE = render(_FULL_REFERENCE_TEMPLATE, RESOLVERS)
