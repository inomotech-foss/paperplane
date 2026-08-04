/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Plus, X } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import type {
  TAutomationConditionGroup,
  TAutomationConditionLeaf,
  TAutomationConditionNode,
  TAutomationLogicalOperator,
  TAutomationMetadata,
  TAutomationOperator,
  TAutomationScope,
} from "@plane/types";
import { CustomSearchSelect } from "@plane/ui";
// local imports
import {
  DAY_COUNT_OPERATORS,
  VALUELESS_OPERATORS,
  findConditionProperty,
  operatorLabelKey,
  usableConditionProperties,
} from "../helpers/metadata";
import { AutomationValueInput } from "./value-input";

type BuilderProps = {
  projectId?: string;
  scope: TAutomationScope;
  metadata: TAutomationMetadata | undefined;
  condition: TAutomationConditionNode | null;
  onChange: (condition: TAutomationConditionNode | null) => void;
  disabled?: boolean;
};

/** Stable-enough client ids so React keys survive re-ordering. */
let nodeCounter = 0;
const nextNodeId = () => `node-${Date.now().toString(36)}-${(nodeCounter += 1)}`;

const emptyGroup = (logicalOperator: TAutomationLogicalOperator = "and"): TAutomationConditionGroup => ({
  type: "group",
  id: nextNodeId(),
  logical_operator: logicalOperator,
  children: [],
});

const emptyLeaf = (): TAutomationConditionLeaf => ({
  type: "condition",
  id: nextNodeId(),
  property: "",
  operator: "in",
  value: [],
});

/**
 * Give every node an id. A tree round-tripped through the API may predate client
 * side id assignment, and list keys must not fall back to the array index — a
 * reordered condition would otherwise carry the wrong row's state.
 *
 * Call this once when hydrating, never during render.
 */
export const ensureConditionIds = (node: TAutomationConditionNode | null): TAutomationConditionNode | null => {
  if (!node) return null;
  if (node.type === "condition") return { ...node, id: node.id ?? nextNodeId() };
  return {
    ...node,
    id: node.id ?? nextNodeId(),
    children: (node.children ?? []).map((child) => ensureConditionIds(child) as TAutomationConditionNode),
  };
};

/** Whether the stored condition is already a group we can append to. */
const asGroup = (condition: TAutomationConditionNode | null): TAutomationConditionGroup => {
  if (condition && condition.type === "group") return condition;
  if (condition && condition.type === "condition") {
    return { type: "group", id: nextNodeId(), logical_operator: "and", children: [condition] };
  }
  return emptyGroup();
};

/**
 * Sensible starting value when the property or operator changes, so the row is
 * never left holding a value shape the new operator can't use.
 */
const resetValueFor = (operator: TAutomationOperator, multiple: boolean): unknown => {
  if (VALUELESS_OPERATORS.includes(operator)) return null;
  if (DAY_COUNT_OPERATORS.includes(operator)) return 1;
  if (operator === "in" || operator === "not_in" || operator === "contains" || operator === "not_contains") {
    return multiple ? [] : [];
  }
  return null;
};

type LeafRowProps = {
  projectId?: string;
  scope: TAutomationScope;
  metadata: TAutomationMetadata | undefined;
  leaf: TAutomationConditionLeaf;
  onChange: (leaf: TAutomationConditionLeaf) => void;
  onRemove: () => void;
  disabled?: boolean;
};

const ConditionRow = observer(function ConditionRow(props: LeafRowProps) {
  const { projectId, scope, metadata, leaf, onChange, onRemove, disabled } = props;
  const { t } = useTranslation();

  const properties = usableConditionProperties(metadata, scope);
  const definition = findConditionProperty(metadata, leaf.property);

  const propertyOptions = properties.map((property) => ({
    value: property.key,
    query: t(property.i18n_label),
    content: <span className="truncate">{t(property.i18n_label)}</span>,
  }));

  const operatorOptions = (definition?.operators ?? []).map((operator) => ({
    value: operator,
    query: t(operatorLabelKey(operator)),
    content: <span className="truncate">{t(operatorLabelKey(operator))}</span>,
  }));

  const handlePropertyChange = (propertyKey: string) => {
    const nextDefinition = findConditionProperty(metadata, propertyKey);
    const nextOperator = (nextDefinition?.operators[0] ?? "in") as TAutomationOperator;
    onChange({
      ...leaf,
      property: propertyKey,
      operator: nextOperator,
      value: resetValueFor(nextOperator, nextDefinition?.kind === "multi_option") as never,
    });
  };

  const handleOperatorChange = (operator: TAutomationOperator) => {
    onChange({
      ...leaf,
      operator,
      value: resetValueFor(operator, definition?.kind === "multi_option") as never,
    });
  };

  const showDayCount = DAY_COUNT_OPERATORS.includes(leaf.operator);
  const showValue = !VALUELESS_OPERATORS.includes(leaf.operator) && !showDayCount && !!definition;
  // `in`/`contains` accept several values regardless of the property's own kind.
  const acceptsMultiple =
    definition?.kind === "multi_option" ||
    ["in", "not_in", "contains", "not_contains", "changed_to", "changed_from"].includes(leaf.operator);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-subtle bg-layer-2 px-3 py-2">
      <div className="min-w-40 flex-1">
        <CustomSearchSelect
          value={leaf.property || null}
          options={propertyOptions}
          onChange={handlePropertyChange}
          disabled={disabled}
          input
          className="w-full"
          label={
            definition ? (
              <span className="truncate">{t(definition.i18n_label)}</span>
            ) : (
              <span className="text-tertiary">{t("automations.designer.select_property")}</span>
            )
          }
        />
      </div>

      <div className="min-w-36 flex-1">
        <CustomSearchSelect
          value={leaf.operator}
          options={operatorOptions}
          onChange={handleOperatorChange}
          disabled={disabled || !definition}
          input
          className="w-full"
          label={
            leaf.operator ? (
              <span className="truncate">{t(operatorLabelKey(leaf.operator))}</span>
            ) : (
              <span className="text-tertiary">{t("automations.designer.select_operator")}</span>
            )
          }
        />
      </div>

      {showDayCount && (
        <div className="flex min-w-32 flex-1 items-center gap-2">
          <Input
            type="number"
            min={0}
            value={typeof leaf.value === "number" ? String(leaf.value) : ""}
            onChange={(event) =>
              onChange({ ...leaf, value: event.target.value === "" ? null : Number(event.target.value) })
            }
            disabled={disabled}
            className="w-20"
          />
          <span className="shrink-0 text-13 text-tertiary">{t("automations.operator_suffix.days")}</span>
        </div>
      )}

      {showValue && (
        <div className="min-w-40 flex-1">
          <AutomationValueInput
            projectId={projectId}
            kind={definition.kind}
            source={definition.source}
            multiple={acceptsMultiple}
            value={leaf.value}
            onChange={(value) => onChange({ ...leaf, value: value as never })}
            disabled={disabled}
          />
        </div>
      )}

      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={t("automations.designer.remove_condition")}
        className="shrink-0 rounded-sm p-1 text-tertiary hover:bg-layer-1 hover:text-primary disabled:opacity-50"
      >
        <X className="size-4" />
      </button>
    </div>
  );
});

type GroupProps = BuilderProps & {
  group: TAutomationConditionGroup;
  depth: number;
  onRemoveGroup?: () => void;
};

const ConditionGroup = observer(function ConditionGroup(props: GroupProps) {
  const { projectId, scope, metadata, group, depth, onChange, onRemoveGroup, disabled } = props;
  const { t } = useTranslation();

  const replaceChild = (index: number, child: TAutomationConditionNode) => {
    const children = [...group.children];
    children[index] = child;
    onChange({ ...group, children });
  };

  const removeChild = (index: number) => {
    const children = group.children.filter((_, childIndex) => childIndex !== index);
    onChange({ ...group, children });
  };

  const toggleLogicalOperator = () => {
    onChange({ ...group, logical_operator: group.logical_operator === "and" ? "or" : "and" });
  };

  return (
    <div
      className={
        depth === 0 ? "flex flex-col gap-2" : "flex flex-col gap-2 rounded-md border border-dashed border-subtle p-3"
      }
    >
      {group.children.map((child, index) => (
        <div key={child.id} className="flex flex-col gap-2">
          {index > 0 && (
            <button
              type="button"
              onClick={toggleLogicalOperator}
              disabled={disabled}
              className="w-fit rounded-sm border border-subtle bg-layer-2 px-2 py-0.5 text-11 font-medium tracking-wide text-secondary uppercase hover:bg-layer-1 disabled:opacity-50"
            >
              {t(`automations.conjunctions.${group.logical_operator}`)}
            </button>
          )}
          {child.type === "condition" ? (
            <ConditionRow
              projectId={projectId}
              scope={scope}
              metadata={metadata}
              leaf={child}
              onChange={(leaf) => replaceChild(index, leaf)}
              onRemove={() => removeChild(index)}
              disabled={disabled}
            />
          ) : (
            <ConditionGroup
              projectId={projectId}
              scope={scope}
              metadata={metadata}
              condition={child}
              group={child}
              depth={depth + 1}
              onChange={(next) => next && replaceChild(index, next)}
              onRemoveGroup={() => removeChild(index)}
              disabled={disabled}
            />
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          prependIcon={<Plus />}
          disabled={disabled}
          onClick={() => onChange({ ...group, children: [...group.children, emptyLeaf()] })}
        >
          {t("automations.condition.add_condition")}
        </Button>
        {/* One level of nesting is enough to express the usual "A and (B or C)". */}
        {depth < 1 && (
          <Button
            variant="ghost"
            size="sm"
            prependIcon={<Plus />}
            disabled={disabled}
            onClick={() => onChange({ ...group, children: [...group.children, emptyGroup("or")] })}
          >
            {t("automations.designer.add_condition_group")}
          </Button>
        )}
        {onRemoveGroup && (
          <Button variant="error-outline" size="sm" disabled={disabled} onClick={onRemoveGroup}>
            {t("automations.designer.remove_group")}
          </Button>
        )}
      </div>
    </div>
  );
});

/**
 * The condition editor. An empty tree is stored as `null` so the backend treats
 * the automation as unconditional.
 */
export const AutomationConditionBuilder = observer(function AutomationConditionBuilder(props: BuilderProps) {
  const { projectId, scope, metadata, condition, onChange, disabled } = props;
  const group = asGroup(condition);

  return (
    <ConditionGroup
      projectId={projectId}
      scope={scope}
      metadata={metadata}
      condition={group}
      group={group}
      depth={0}
      onChange={(next) => {
        if (!next || next.type !== "group" || next.children.length === 0) {
          onChange(null);
          return;
        }
        onChange(next);
      }}
      disabled={disabled}
    />
  );
});
