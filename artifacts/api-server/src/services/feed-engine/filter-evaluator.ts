import type { FilterGroup, FilterRule } from "@workspace/db/schema";

type FilterNode = FilterRule | FilterGroup;

function isGroup(node: FilterNode): node is FilterGroup {
  return node.type === "group";
}

function coerceNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function evaluateRule(product: Record<string, unknown>, rule: FilterRule): boolean {
  const raw = product[rule.field];
  const rv = rule.value;

  switch (rule.operator) {
    case "equals":
      return String(raw ?? "").toLowerCase() === String(rv).toLowerCase();
    case "not_equals":
      return String(raw ?? "").toLowerCase() !== String(rv).toLowerCase();
    case "contains":
      return String(raw ?? "").toLowerCase().includes(String(rv).toLowerCase());
    case "is_greater_than":
      return coerceNum(raw) > coerceNum(rv);
    case "is_less_than":
      return coerceNum(raw) < coerceNum(rv);
    case "is_not_empty":
      return raw !== null && raw !== undefined && String(raw).trim() !== "";
    case "regex_match": {
      try {
        return new RegExp(String(rv), "i").test(String(raw ?? ""));
      } catch {
        return false;
      }
    }
    default:
      return true;
  }
}

export function evaluateFilters(product: Record<string, unknown>, group: FilterGroup): boolean {
  if (!group.rules || group.rules.length === 0) return true;

  if (group.condition === "AND") {
    return group.rules.every((node) =>
      isGroup(node) ? evaluateFilters(product, node) : evaluateRule(product, node),
    );
  }
  return group.rules.some((node) =>
    isGroup(node) ? evaluateFilters(product, node) : evaluateRule(product, node),
  );
}
