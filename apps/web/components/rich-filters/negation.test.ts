import { describe, expect, it } from "vitest";
import { FilterInstance, workItemFiltersAdapter } from "@plane/shared-state";
import type { SingleOrArray, TFilterValue, TWorkItemFilterExpression, TWorkItemFilterProperty } from "@plane/types";
import { COLLECTION_OPERATOR, EQUALITY_OPERATOR, LOGICAL_OPERATOR } from "@plane/types";
import {
  getOperatorForPayload,
  getStateFilterConfig,
  getTitleFilterConfig,
  getWorkItemDateOperators,
} from "@plane/utils";

const operatorConfigs = {
  allowedOperators: new Set([
    EQUALITY_OPERATOR.EXACT,
    EQUALITY_OPERATOR.ICONTAINS,
    COLLECTION_OPERATOR.IN,
    "range" as const,
    "gt" as const,
    "lt" as const,
  ]),
  allowNegative: true as const,
};

const states = [
  { id: "done", name: "Done", group: "completed" },
  { id: "open", name: "Open", group: "unstarted" },
] as never[];

const makeFilter = (initialExpression?: TWorkItemFilterExpression) => {
  const filter = new FilterInstance<TWorkItemFilterProperty, TWorkItemFilterExpression>({
    adapter: workItemFiltersAdapter,
    initialExpression,
  });
  filter.configManager.registerAll([
    getStateFilterConfig<TWorkItemFilterProperty>("state_id")({ isEnabled: true, states, ...operatorConfigs }),
    getTitleFilterConfig<TWorkItemFilterProperty>("name")({ isEnabled: true, ...operatorConfigs }),
  ]);
  return filter;
};

// condition values are single values or lists; the config takes them the way the filter item passes them
const value = (conditionValue: SingleOrArray<TFilterValue>) => conditionValue as TFilterValue;

const external = (filter: ReturnType<typeof makeFilter>) =>
  filter.expression ? workItemFiltersAdapter.toExternal(filter.expression) : {};

describe("negated conditions in the click-together filters", () => {
  it("reads and writes a NOT group like the API does", () => {
    const expression = { and: [{ not: { state_id__in: "done" } }, { name__icontains: "tcu" }] };
    const filter = makeFilter(expression as TWorkItemFilterExpression);

    expect(external(filter)).toEqual(expression);
    expect(filter.allConditionsForDisplay.map((condition) => condition.operator)).toEqual(["not_in", "icontains"]);
  });

  it("adds a negated condition inside a NOT group", () => {
    const filter = makeFilter();
    const { operator, isNegation } = getOperatorForPayload("not_icontains");
    filter.addCondition(LOGICAL_OPERATOR.AND, { property: "name", operator, value: "draft" }, isNegation);

    expect(external(filter)).toEqual({ not: { name__icontains: "draft" } });
  });

  it("switching to 'is not' wraps the condition, switching back unwraps it", () => {
    const filter = makeFilter({ and: [{ state_id__in: "done" }, { name__icontains: "tcu" }] });
    const stateCondition = filter.allConditions.find((condition) => condition.property === "state_id")!;

    filter.updateConditionOperator(stateCondition.id, COLLECTION_OPERATOR.IN, true);
    expect(external(filter)).toEqual({ and: [{ not: { state_id__in: "done" } }, { name__icontains: "tcu" }] });

    filter.updateConditionOperator(stateCondition.id, COLLECTION_OPERATOR.IN, false);
    expect(external(filter)).toEqual({ and: [{ state_id__in: "done" }, { name__icontains: "tcu" }] });
  });

  it("removing a negated condition removes its NOT group", () => {
    const filter = makeFilter({ and: [{ not: { state_id__in: "done" } }, { name__icontains: "tcu" }] });
    const stateCondition = filter.allConditions.find((condition) => condition.property === "state_id")!;

    filter.removeCondition(stateCondition.id);

    expect(external(filter)).toEqual({ name__icontains: "tcu" });
  });

  it("offers the negated operators, reading 'is not' for a single value", () => {
    const filter = makeFilter();
    const stateConfig = filter.configManager.getConfigByProperty("state_id")!;
    const titleConfig = filter.configManager.getConfigByProperty("name")!;

    expect(stateConfig.getAllDisplayOperatorOptionsByValue(value(["done"]))).toEqual([
      { value: "in", label: "is" },
      { value: "not_in", label: "is not" },
    ]);
    expect(stateConfig.getAllDisplayOperatorOptionsByValue(value(["done", "open"]))).toEqual([
      { value: "in", label: "is any of" },
      { value: "not_in", label: "is none of" },
    ]);
    expect(titleConfig.getAllDisplayOperatorOptionsByValue("tcu")).toEqual([
      { value: "icontains", label: "contains" },
      { value: "not_icontains", label: "does not contain" },
    ]);
  });

  it("work item dates can be before and after a day, but not negated", () => {
    const operators = getWorkItemDateOperators({ isEnabled: true, ...operatorConfigs });

    expect([...operators.keys()]).toEqual(["exact", "range", "gt", "lt"]);
  });
});
