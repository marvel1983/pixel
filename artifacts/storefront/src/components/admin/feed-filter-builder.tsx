import { Plus, Trash2, ChevronDown } from "lucide-react";

export interface FilterRule { id: string; type: "rule"; field: string; operator: string; value: string }
export interface FilterGroup { id: string; type: "group"; condition: "AND" | "OR"; rules: (FilterRule | FilterGroup)[] }

const OPERATORS = [
  { value: "equals",           label: "equals" },
  { value: "not_equals",       label: "not equals" },
  { value: "contains",         label: "contains" },
  { value: "is_greater_than",  label: "is greater than" },
  { value: "is_less_than",     label: "is less than" },
  { value: "is_not_empty",     label: "is not empty" },
  { value: "regex_match",      label: "matches regex" },
];

function uid() { return Math.random().toString(36).slice(2, 9); }

function newRule(): FilterRule {
  return { id: uid(), type: "rule", field: "price", operator: "is_greater_than", value: "0" };
}
function newGroup(): FilterGroup {
  return { id: uid(), type: "group", condition: "AND", rules: [newRule()] };
}

interface RuleRowProps {
  rule: FilterRule;
  fields: { key: string; label: string }[];
  onChange: (r: FilterRule) => void;
  onDelete: () => void;
}
function RuleRow({ rule, fields, onChange, onDelete }: RuleRowProps) {
  const sel = "rounded border border-[#2e3340] bg-[#0c1018] px-2 py-1.5 text-[12px] text-[#dde4f0] focus:outline-none";
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select className={sel} value={rule.field} onChange={(e) => onChange({ ...rule, field: e.target.value })}>
        {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
      </select>
      <select className={sel} value={rule.operator} onChange={(e) => onChange({ ...rule, operator: e.target.value })}>
        {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {rule.operator !== "is_not_empty" && (
        <input
          className="rounded border border-[#2e3340] bg-[#0c1018] px-2 py-1.5 text-[12px] text-[#dde4f0] w-32 focus:outline-none"
          value={rule.value}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
          placeholder="value"
        />
      )}
      <button onClick={onDelete} className="rounded p-1 text-red-400 hover:bg-red-900/30 transition-colors">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

interface GroupProps {
  group: FilterGroup;
  fields: { key: string; label: string }[];
  onChange: (g: FilterGroup) => void;
  onDelete?: () => void;
  depth?: number;
}
function Group({ group, fields, onChange, onDelete, depth = 0 }: GroupProps) {
  const updateRule = (idx: number, updated: FilterRule | FilterGroup) => {
    const rules = [...group.rules];
    rules[idx] = updated;
    onChange({ ...group, rules });
  };
  const deleteRule = (idx: number) => {
    onChange({ ...group, rules: group.rules.filter((_, i) => i !== idx) });
  };
  const addRule = () => onChange({ ...group, rules: [...group.rules, newRule()] });
  const addGroup = () => onChange({ ...group, rules: [...group.rules, newGroup()] });

  return (
    <div className={`rounded border border-[#2e3340] bg-[#0f1520] p-3 space-y-2 ${depth > 0 ? "ml-4" : ""}`}>
      <div className="flex items-center gap-2">
        <select
          className="rounded border border-[#2e3340] bg-[#181c24] px-2 py-1 text-[12px] font-bold text-[#a8d4f5] focus:outline-none"
          value={group.condition}
          onChange={(e) => onChange({ ...group, condition: e.target.value as "AND" | "OR" })}
        >
          <option value="AND">AND</option>
          <option value="OR">OR</option>
        </select>
        <span className="text-[11px] text-[#5a6a84]">— all/any of the following must match</span>
        {onDelete && (
          <button onClick={onDelete} className="ml-auto rounded p-1 text-red-400 hover:bg-red-900/30 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {group.rules.map((node, idx) =>
        node.type === "rule"
          ? <RuleRow key={node.id} rule={node} fields={fields} onChange={(r) => updateRule(idx, r)} onDelete={() => deleteRule(idx)} />
          : <Group key={node.id} group={node} fields={fields} onChange={(g) => updateRule(idx, g)} onDelete={() => deleteRule(idx)} depth={depth + 1} />,
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={addRule} className="flex items-center gap-1 rounded border border-[#2e3340] px-2 py-1 text-[11px] text-[#a8d4f5] hover:bg-[#1a2235] transition-colors">
          <Plus className="h-3 w-3" /> Add Rule
        </button>
        {depth < 2 && (
          <button onClick={addGroup} className="flex items-center gap-1 rounded border border-[#2e3340] px-2 py-1 text-[11px] text-[#5b9fd4] hover:bg-[#1a2235] transition-colors">
            <ChevronDown className="h-3 w-3" /> Add Group
          </button>
        )}
      </div>
    </div>
  );
}

interface Props {
  value: FilterGroup;
  onChange: (g: FilterGroup) => void;
  fields: { key: string; label: string }[];
}
export function FeedFilterBuilder({ value, onChange, fields }: Props) {
  return <Group group={value} fields={fields} onChange={onChange} />;
}
