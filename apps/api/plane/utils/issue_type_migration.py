# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Moving the rows of a work item type to another type, with the custom property values they carry.

Values of properties scoped to the old type alone would be hidden on the new type, so each
such property with values must be mapped to a compatible property of the new type or
dropped explicitly. Properties both types share keep their values untouched.
"""

from dataclasses import dataclass

# Django imports
from django.db import transaction
from django.db.models import Count

# Module imports
from plane.db.models import (
    AutomationAction,
    DraftIssue,
    Intake,
    Issue,
    IssueProperty,
    IssuePropertyOption,
    IssuePropertyValue,
    IssueType,
    Project,
    ProjectIssueType,
)
from plane.db.models.issue_property import PropertyDerivationChoices, PropertyTypeChoices
from plane.utils.derived_properties import schedule_derived_refresh
from plane.utils.uuid import is_valid_uuid

CREATE_WORK_ITEM_ACTION = "create_work_item"
COMPUTED = (PropertyDerivationChoices.LOOKUP, PropertyDerivationChoices.ROLLUP)
WORK_ITEMS, PROJECT, WORKSPACE = "work_items", "project", "workspace"
UNLINK, DELETE = "unlink", "delete"


class MigrationError(Exception):
    """A request the migration cannot run. `payload` is the response body."""

    def __init__(self, payload, status=400):
        super().__init__(payload)
        self.payload = payload if isinstance(payload, dict) else {"error": payload}
        self.status = status


@dataclass(frozen=True)
class Scope:
    kind: str
    project_id: str | None = None
    work_item_ids: tuple = ()


def parse_scope(raw, issue_type, project_id=None):
    """Read `{"work_items": [ids]}`, `{"project": id}` or `{"workspace": true}`.

    `project_id` is set on the project endpoints, which only reach that project's rows.
    """
    if not isinstance(raw, dict) or len(raw) != 1:
        raise MigrationError({"scope": "Give exactly one of work_items, project or workspace."})
    ((kind, value),) = raw.items()
    if kind == WORK_ITEMS:
        if not isinstance(value, list) or not value or not all(is_valid_uuid(str(item)) for item in value):
            raise MigrationError({"scope": "work_items must be a list of work item ids."})
        ids = {str(item) for item in value}
        items = Issue.all_objects.filter(pk__in=ids, workspace_id=issue_type.workspace_id)
        if project_id:
            items = items.filter(project_id=project_id)
        if {str(item) for item in items.values_list("id", flat=True)} != ids:
            raise MigrationError({"scope": "Some of the work items do not exist here."})
        if items.exclude(type_id=issue_type.id).exists():
            raise MigrationError({"scope": f"Some of the work items are not of the type {issue_type.name}."})
        return Scope(WORK_ITEMS, work_item_ids=tuple(sorted(ids)))
    if kind == PROJECT:
        valid = is_valid_uuid(str(value)) and (not project_id or str(value) == str(project_id))
        if not valid or not Project.objects.filter(pk=value, workspace_id=issue_type.workspace_id).exists():
            raise MigrationError({"scope": "The project does not exist here."})
        return Scope(PROJECT, project_id=str(value))
    if kind == WORKSPACE:
        if value is not True or project_id:
            raise MigrationError({"scope": "The whole workspace can only be migrated through the workspace endpoint."})
        return Scope(WORKSPACE)
    raise MigrationError({"scope": "Give exactly one of work_items, project or workspace."})


def _action_project_id(action):
    """The project a "create work item" action creates in, None when it follows the run."""
    project_id = action.config.get("project_id") or action.automation.project_id
    return str(project_id) if project_id else None


def _is_computed(prop):
    return prop.derivation in COMPUTED


def _compatible(source, target):
    return (
        source.property_type == target.property_type
        and source.is_multi == target.is_multi
        and (source.relation_type or None) == (target.relation_type or None)
    )


class TypeReferences:
    """Every row in `scope` that points at `issue_type`.

    Soft-deleted rows count too: they are kept until the nightly purge and must stay valid.
    Drafts, intakes and automations belong to a project, so only project and workspace
    scopes reach them.
    """

    def __init__(self, issue_type, scope):
        self.issue_type = issue_type
        self.scope = scope
        self.issues = Issue.all_objects.filter(type_id=issue_type.id, workspace_id=issue_type.workspace_id)
        self.drafts = DraftIssue.all_objects.filter(type_id=issue_type.id, workspace_id=issue_type.workspace_id)
        self.intakes = Intake.all_objects.filter(issue_type_id=issue_type.id)
        actions = AutomationAction.all_objects.filter(
            workspace_id=issue_type.workspace_id,
            action_type=CREATE_WORK_ITEM_ACTION,
            config__type_id=str(issue_type.id),
        ).select_related("automation")
        if scope.kind == WORK_ITEMS:
            self.issues = self.issues.filter(pk__in=scope.work_item_ids)
            self.drafts = self.drafts.none()
            self.intakes = self.intakes.none()
            self.actions = []
        elif scope.kind == PROJECT:
            self.issues = self.issues.filter(project_id=scope.project_id)
            self.drafts = self.drafts.filter(project_id=scope.project_id)
            self.intakes = self.intakes.filter(project_id=scope.project_id)
            self.actions = [action for action in actions if _action_project_id(action) == scope.project_id]
        else:
            self.actions = list(actions)

    def counts(self):
        return {
            "work_items": self.issues.filter(deleted_at__isnull=True).count(),
            "deleted_work_items": self.issues.filter(deleted_at__isnull=False).count(),
            "drafts": self.drafts.count(),
            "intakes": self.intakes.count(),
            "automation_actions": len(self.actions),
        }

    def exist(self):
        return bool(self.actions or self.issues.exists() or self.drafts.exists() or self.intakes.exists())

    def project_ids(self):
        ids = set(self.issues.values_list("project_id", flat=True).distinct())
        ids |= set(self.drafts.exclude(project_id__isnull=True).values_list("project_id", flat=True).distinct())
        ids |= set(self.intakes.values_list("project_id", flat=True).distinct())
        ids |= {action_project for action in self.actions if (action_project := _action_project_id(action))}
        return {str(project_id) for project_id in ids}

    def own_properties(self):
        """Properties of the old type alone whose values the rows in scope carry, with how many use them."""
        properties = (
            IssueProperty.objects.filter(issue_type_id=self.issue_type.id, project_id__in=self.project_ids())
            .exclude(derivation__in=COMPUTED)
            .order_by("project_id", "sort_order")
        )
        values = IssuePropertyValue.objects.filter(property__in=properties, issue__in=self.issues, is_derived=False)
        per_property = dict(
            values.values("property_id")
            .annotate(items=Count("issue_id", distinct=True))
            .values_list("property_id", "items")
        )
        per_option = {}
        for property_id, option_id, items in (
            values.exclude(value_option__isnull=True)
            .values("property_id", "value_option_id")
            .annotate(items=Count("issue_id", distinct=True))
            .values_list("property_id", "value_option_id", "items")
        ):
            per_option.setdefault(property_id, {})[option_id] = items
        result = []
        for prop in properties:
            if not per_property.get(prop.id):
                continue
            options = IssuePropertyOption.objects.filter(pk__in=per_option.get(prop.id, {}).keys())
            result.append(
                {
                    "property": prop,
                    "work_items": per_property[prop.id],
                    "options": [(option, per_option[prop.id][option.id]) for option in options],
                }
            )
        return result

    def preview(self):
        return {
            "references": self.counts(),
            "properties": [
                {
                    "id": str(entry["property"].id),
                    "project_id": str(entry["property"].project_id),
                    "name": entry["property"].display_name or entry["property"].name,
                    "property_type": entry["property"].property_type,
                    "is_multi": entry["property"].is_multi,
                    "relation_type": entry["property"].relation_type,
                    "work_items": entry["work_items"],
                    "options": [
                        {"id": str(option.id), "name": option.name, "work_items": items}
                        for option, items in entry["options"]
                    ],
                }
                for entry in self.own_properties()
            ],
        }

    def replacement_error(self, replacement):
        """Why `replacement` cannot take over these rows, or None."""
        if replacement is None:
            return f"Work items still use the type {self.issue_type.name}. Choose a type to move them to."
        if replacement.id == self.issue_type.id:
            return "Choose a different type to move the work items to."
        if replacement.workspace_id != self.issue_type.workspace_id or not replacement.is_active:
            return "The replacement type must be an active type of this workspace."
        if replacement.is_epic != self.issue_type.is_epic:
            return "Epics can only move to an epic type, and other work items only to a type that is not an epic."
        linked = set(ProjectIssueType.objects.filter(issue_type_id=replacement.id).values_list("project_id", flat=True))
        # Rows of deleted projects move too, but those projects cannot link types anymore.
        missing = Project.objects.filter(pk__in=self.project_ids()).exclude(pk__in=linked).order_by("identifier")
        if missing:
            names = ", ".join(f"{project.name} ({project.identifier})" for project in missing)
            return f"The type {replacement.name} is not enabled in these projects: {names}."
        return None

    def plan_properties(self, replacement, mapping):
        """Check `mapping` against the old type's properties and return what to do with each.

        Each property with values gets `("drop",)` or `("target", property, {old option: new option or None})`.
        """
        if mapping is None:
            mapping = {}
        if not isinstance(mapping, dict):
            raise MigrationError({"property_mapping": "property_mapping must be an object keyed by property id."})
        errors = {}
        plan = []
        for entry in self.own_properties():
            prop = entry["property"]
            decision = mapping.get(str(prop.id))
            if not isinstance(decision, dict):
                errors[str(prop.id)] = f"Map {prop.display_name or prop.name} to a property of the new type or drop it."
                continue
            if decision.get("drop") is True:
                plan.append((prop, ("drop",)))
                continue
            target = self._target(prop, replacement, decision.get("target"))
            if isinstance(target, str):
                errors[str(prop.id)] = target
                continue
            options = self._option_map(prop, target, entry["options"], decision.get("options") or {})
            if isinstance(options, str):
                errors[str(prop.id)] = options
                continue
            plan.append((prop, ("target", target, options)))
        if errors:
            raise MigrationError({"error": "Some custom property values need a decision.", "property_mapping": errors})
        return plan

    @staticmethod
    def _target(prop, replacement, target_id):
        if not target_id or not is_valid_uuid(str(target_id)):
            return f"Map {prop.display_name or prop.name} to a property of the new type or drop it."
        target = IssueProperty.objects.filter(pk=target_id, project_id=prop.project_id, is_active=True).first()
        if target is None or target.issue_type_id not in (None, replacement.id) or _is_computed(target):
            return "The target property is not available on the new type."
        if not _compatible(prop, target):
            return f"{target.display_name or target.name} cannot hold the values of {prop.display_name or prop.name}."
        return target

    @staticmethod
    def _option_map(prop, target, used_options, explicit):
        if prop.property_type != PropertyTypeChoices.OPTION:
            return {}
        if not isinstance(explicit, dict):
            return "options must be an object keyed by option id."
        target_options = {option.name: option.id for option in IssuePropertyOption.objects.filter(property=target)}
        target_ids = set(target_options.values())
        result, missing = {}, []
        for option, _ in used_options:
            if str(option.id) in explicit:
                chosen = explicit[str(option.id)]
                if chosen is not None and (not is_valid_uuid(str(chosen)) or str(chosen) not in map(str, target_ids)):
                    return f"The option for {option.name} is not an option of the target property."
                result[option.id] = chosen
            elif option.name in target_options:
                result[option.id] = target_options[option.name]
            else:
                missing.append(option.name)
        if missing:
            return f"Choose an option or drop the values for: {', '.join(missing)}."
        return result

    def apply_properties(self, plan):
        for prop, decision in plan:
            values = IssuePropertyValue.all_objects.filter(property=prop, issue__in=self.issues)
            if decision[0] == "drop":
                values.delete()
                continue
            _, target, options = decision
            # Values the work items already have on the target stay, the moved ones do not overwrite them.
            kept = set(
                IssuePropertyValue.objects.filter(property=target, issue__in=self.issues, is_derived=False).values_list(
                    "issue_id", flat=True
                )
            )
            is_option = prop.property_type == PropertyTypeChoices.OPTION
            seen = set()
            for row in values:
                option_id = options.get(row.value_option_id) if is_option else None
                key = (row.issue_id, str(option_id))
                dropped = is_option and option_id is None
                if row.is_derived or row.deleted_at or row.issue_id in kept or dropped or key in seen:
                    row.delete(soft=False)
                    continue
                seen.add(key)
                row.property_id = target.id
                if is_option:
                    row.value_option_id = option_id
                row.save(update_fields=["property", "value_option", "updated_at"])

    def move_to(self, replacement):
        """Point every row at `replacement`."""
        self.issues.update(type_id=replacement.id)
        self.drafts.update(type_id=replacement.id)
        self.intakes.update(issue_type_id=replacement.id)
        for action in self.actions:
            action.config = {**action.config, "type_id": str(replacement.id)}
            action.save(update_fields=["config"])


def removal_error(issue_type, project_id=None):
    """Why `issue_type` cannot leave `project_id`, or the workspace when None, whatever uses it."""
    if issue_type.is_epic:
        return "Epic type cannot be removed"
    links = ProjectIssueType.objects.filter(issue_type_id=issue_type.id)
    if project_id is not None:
        links = links.filter(project_id=project_id)
    stranded = [
        str(link.project_id)
        for link in links
        if not ProjectIssueType.objects.filter(project_id=link.project_id, issue_type__is_active=True)
        .exclude(issue_type_id=issue_type.id)
        .exists()
    ]
    if stranded and project_id is not None:
        return "A project must have at least one work item type"
    if stranded:
        return f"This is the only work item type of project(s) {', '.join(stranded)}"
    return None


def _remove(issue_type, project_id=None):
    links = ProjectIssueType.objects.filter(issue_type_id=issue_type.id)
    if project_id is not None:
        links = links.filter(project_id=project_id)
    links.delete()
    workspace_wide = TypeReferences(issue_type, Scope(WORKSPACE))
    if project_id is None or not (
        ProjectIssueType.objects.filter(issue_type_id=issue_type.id).exists() or workspace_wide.exist()
    ):
        issue_type.delete()


def remove_unused_type(issue_type, project_id=None):
    """Unlink `issue_type` from `project_id`, or delete it from the workspace when None.

    Only works while nothing in that scope uses the type; the migration moves those rows first.
    """
    error = removal_error(issue_type, project_id)
    if error:
        raise MigrationError(error)
    scope = Scope(PROJECT, project_id=str(project_id)) if project_id else Scope(WORKSPACE)
    if TypeReferences(issue_type, scope).exist():
        raise MigrationError(
            {
                "error": f"Work items or settings still use the type {issue_type.name}. "
                "Move them to another type with the type migration first.",
                "code": "type_in_use",
            },
            status=409,
        )
    with transaction.atomic():
        _remove(issue_type, project_id)


def migrate_type(issue_type, data, project_id=None):
    """Run or preview a type migration described by a request body. Returns the preview of the scope.

    Moves the rows in scope to `replacement_type_id`, maps or drops the old type's property
    values, then unlinks or deletes the type when `then` asks for it, all in one transaction.
    """
    if not isinstance(data, dict):
        raise MigrationError("The body must be an object.")
    scope = parse_scope(data.get("scope"), issue_type, project_id)
    references = TypeReferences(issue_type, scope)
    preview = references.preview()
    if data.get("dry_run"):
        return preview

    then = data.get("then")
    if then not in (None, UNLINK, DELETE):
        raise MigrationError({"then": 'then must be "unlink" or "delete".'})
    if then == UNLINK and scope.kind != PROJECT:
        raise MigrationError({"then": "Only a project scope can unlink the type."})
    if then == DELETE and scope.kind != WORKSPACE:
        raise MigrationError({"then": "Only the workspace scope can delete the type."})
    if then and (error := removal_error(issue_type, scope.project_id if then == UNLINK else None)):
        raise MigrationError(error)

    replacement_id = data.get("replacement_type_id")
    replacement = None
    if replacement_id:
        if not is_valid_uuid(str(replacement_id)):
            raise MigrationError({"replacement_type_id": "The replacement type is not a valid id."})
        replacement = IssueType.objects.filter(pk=replacement_id).first()
        if replacement is None:
            raise MigrationError({"replacement_type_id": "The replacement type does not exist."})
    has_rows = references.exist()
    if has_rows:
        if error := references.replacement_error(replacement):
            raise MigrationError({"replacement_type_id": error})
        plan = references.plan_properties(replacement, data.get("property_mapping"))

    project_ids = references.project_ids()
    with transaction.atomic():
        if has_rows:
            references.apply_properties(plan)
            references.move_to(replacement)
        if then:
            _remove(issue_type, scope.project_id if then == UNLINK else None)
        for affected in project_ids:
            schedule_derived_refresh(affected)
    return preview


def type_change_error(work_item, new_type_id):
    """Why changing `work_item` to `new_type_id` in a plain update would lose data, or None."""
    if not work_item.type_id or str(work_item.type_id) == str(new_type_id):
        return None
    hidden = (
        IssuePropertyValue.objects.filter(
            issue_id=work_item.id, property__issue_type_id=work_item.type_id, is_derived=False
        )
        .exclude(property__derivation__in=COMPUTED)
        .exists()
    )
    if hidden:
        return (
            "This work item has values in custom properties of its current type. "
            "Change its type with the type migration, which maps or drops those values."
        )
    return None
