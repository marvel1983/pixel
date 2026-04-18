import { Plus, Trash2, Info, Filter } from "lucide-react";

export interface FilterRule { id: string; type: "rule"; field: string; operator: string; value: string }
export interface FilterGroup { id: string; type: "group"; condition: "AND" | "OR"; rules: (FilterRule | FilterGroup)[] }

const OPERATORS: Record<string, { value: string; label: string }[]> = {
  text: [
    { value: "equals",      label: "is exactly" },
    { value: "not_equals",  label: "is not" },
    { value: "contains",    label: "contains" },
    { value: "is_not_empty",label: "is not empty" },
  ],
  number: [
    { value: "equals",          label: "equals" },
    { value: "not_equals",      label: "not equals" },
    { value: "is_greater_than", label: "is greater than" },
    { value: "is_less_than",    label: "is less than" },
  ],
  availability: [
    { value: "equals",     label: "is" },
    { value: "not_equals", label: "is not" },
  ],
};

const FIELDS: { key: string; label: string; type: "text" | "number" | "availability"; hint: string }[] = [
  { key: "availability", label: "Stock status",   type: "availability", hint: "in stock / out of stock" },
  { key: "price",        label: "Price (EUR)",     type: "number",       hint: "numeric price in base currency" },
  { key: "stock",        label: "Stock count",     type: "number",       hint: "number of units available" },
  { key: "category",     label: "Category",        type: "text",         hint: "category name" },
  { key: "name",         label: "Product name",    type: "text",         hint: "partial or full name" },
  { key: "sku",          label: "SKU",             type: "text",         hint: "product SKU code" },
  { key: "platform",     label: "Platform",        type: "text",         hint: "e.g. Windows, Mac" },
  { key: "isActive",     label: "Is active",       type: "availability", hint: "true / false" },
];

const FIELD_MAP = Object.fromEntries(FIELDS.map((f) => [f.key, f]));

// Quick-add presets for common use cases
const PRESETS = [
  { label: "Only in stock",       rule: { field: "availability", operator: "equals",          value: "in stock" } },
  { label: "Price above 1",       rule: { field: "price",        operator: "is_greater_than", value: "1" } },
  { label: "Exclude out of stock",rule: { field: "availability", operator: "not_equals",      value: "out of stock" } },
  { label: "Has stock > 0",       rule: { field: "stock",        operator: "is_greater_than", value: "0" } },
];

function uid() { return Math.random().toString(36).slice(2, 9); }
function newRule(field = "availability"): FilterRule {
  return { id: uid(), type: "rule", field, operator: "equals", value: "in stock" };
}
function newGroup(): FilterGroup {
  return { id: uid(), type: "group", condition: "AND", rules: [newRule()] };
}

const sel = "rounded border border-[#2e3340] bg-[#0c1018] px-2 py-1.5 text-[12px] text-[#dde4f0] focus:outline-none focus:border-sky-500/50";

function ValueInput({ rule, onChange }: { rule: FilterRule; onChange: (r: FilterRule) => void }) {
  const fieldMeta = FIELD_MAP[rule.field];
  if (rule.operator === "is_not_empty") return null;

  if (fieldMeta?.type === "availability" && rule.field === "availability") {
    return (
      <select className={sel} value={rule.value} onChange={(e) => onChange({ ...rule, value: e.target.value })}>
        <option value="in stock">in stock</option>
        <option value="out of stock">out of stock</option>
      </select>
    );
  }
  if (fieldMeta?.type === "availability" && rule.field === "isActive") {
    return (
      <select className={sel} value={rule.value} onChange={(e) => onChange({ ...rule, value: e.target.value })}>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  return (
    <input
      className={`${sel} w-36`}
      value={rule.value}
      onChange={(e) => onChange({ ...rule, value: e.target.value })}
      placeholder={fieldMeta?.hint ?? "value"}
      type={fieldMeta?.type === "number" ? "number" : "text"}
    />
  );
}

function RuleRow({ rule, onChange, onDelete }: { rule: FilterRule; onChange: (r: FilterRule) => void; onDelete: () => void }) {
  const fieldMeta = FIELD_MAP[rule.field];
  const ops = OPERATORS[fieldMeta?.type ?? "text"];

  return (
    <div className="flex items-center gap-2 flex-wrap rounded bg-[#0c1018] border border-[#1f2840] px-3 py-2">
      <span className="text-[10.5px] font-semibold text-[#5a6a84] uppercase tracking-wider w-14 shrink-0">Where</span>
      <select className={sel} value={rule.field} onChange={(e) => {
        const newField = FIELD_MAP[e.target.value];
        const defaultOp = OPERATORS[newField?.type ?? "text"][0].value;
        const defaultVal = newField?.type === "availability" ? (e.target.value === "isActive" ? "true" : "in stock") : "";
        onChange({ ...rule, field: e.target.value, operator: defaultOp, value: defaultVal });
      }}>
        {FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
      </select>
      <select className={sel} value={rule.operator} onChange={(e) => onChange({ ...rule, operator: e.target.value })}>
        {ops.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ValueInput rule={rule} onChange={onChange} />
      {fieldMeta && <span className="text-[10px] text-[#3a4a5e] italic hidden sm:block">{fieldMeta.hint}</span>}
      <button onClick={onDelete} title="Remove rule" className="ml-auto rounded p-1 text-red-400 hover:bg-red-900/30 transition-colors">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Group({ group, onChange, onDelete, depth = 0 }: {
  group: FilterGroup; onChange: (g: FilterGroup) => void; onDelete?: () => void; depth?: number;
}) {
  const updateRule = (idx: number, updated: FilterRule | FilterGroup) => {
    const rules = [...group.rules]; rules[idx] = updated; onChange({ ...group, rules });
  };
  const deleteRule = (idx: number) => onChange({ ...group, rules: group.rules.filter((_, i) => i !== idx) });
  const addRule = () => onChange({ ...group, rules: [...group.rules, newRule()] });
  const addGroup = () => onChange({ ...group, rules: [...group.rules, newGroup()] });

  const conditionLabel = group.condition === "AND"
    ? "Product must match ALL of these rules"
    : "Product must match ANY of these rules";

  return (
    <div className={`rounded-lg border ${depth === 0 ? "border-sky-500/20 bg-[#0a0f1a]" : "border-[#2e3340] bg-[#0f1520]"} p-3 space-y-2`}>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 rounded border border-[#2e3340] overflow-hidden">
          {(["AND", "OR"] as const).map((c) => (
            <button key={c} onClick={() => onChange({ ...group, condition: c })}
              className={`px-3 py-1 text-[11px] font-bold transition-colors ${group.condition === c ? "bg-sky-600 text-white" : "bg-transparent text-[#5a6a84] hover:text-[#dde4f0]"}`}>
              {c}
            </button>
          ))}
        </div>
        <span className="text-[11.5px] text-[#7a8aaa]">{conditionLabel}</span>
        {onDelete && (
          <button onClick={onDelete} className="ml-auto rounded p-1 text-red-400 hover:bg-red-900/30 transition-colors" title="Remove group">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {group.rules.length === 0 && (
        <div className="rounded border border-dashed border-[#2e3340] py-4 text-center text-[12px] text-[#3a4a5e]">
          No rules yet — add a rule below to start filtering products
        </div>
      )}

      {group.rules.map((node, idx) =>
        node.type === "rule"
          ? <RuleRow key={node.id} rule={node} onChange={(r) => updateRule(idx, r)} onDelete={() => deleteRule(idx)} />
          : <Group key={node.id} group={node} onChange={(g) => updateRule(idx, g)} onDelete={() => deleteRule(idx)} depth={depth + 1} />,
      )}

      <div className="flex gap-2 pt-1 flex-wrap">
        <button onClick={addRule} className="flex items-center gap-1.5 rounded border border-sky-500/40 px-2.5 py-1 text-[11px] text-sky-400 hover:bg-sky-900/20 transition-colors">
          <Plus className="h-3 w-3" /> Add Rule
        </button>
        {depth < 1 && (
          <button onClick={addGroup} className="flex items-center gap-1.5 rounded border border-[#2e3340] px-2.5 py-1 text-[11px] text-[#5a6a84] hover:bg-[#1a2235] hover:text-[#dde4f0] transition-colors">
            <Plus className="h-3 w-3" /> Add Rule Group (OR/AND)
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

export function FeedFilterBuilder({ value, onChange }: Props) {
  const addPreset = (rule: Omit<FilterRule, "id" | "type">) => {
    onChange({ ...value, rules: [...value.rules, { id: uid(), type: "rule", ...rule }] });
  };

  return (
    <div className="space-y-4">
      {/* Explanation banner */}
      <div className="flex gap-2 rounded border border-sky-500/20 bg-sky-900/10 px-3 py-2.5 text-[12px] text-[#7ab8e8]">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p><span className="font-semibold text-sky-300">Filters decide which products appear in your feed.</span> Only products that pass all rules will be included.</p>
          <p className="text-[#4a7090]">Leave empty to include everything. Use <span className="font-semibold text-[#7ab8e8]">AND</span> to require multiple conditions, <span className="font-semibold text-[#7ab8e8]">OR</span> to allow any one of them.</p>
        </div>
      </div>

      {/* Quick-add presets */}
      <div className="space-y-1.5">
        <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#5a6a84] flex items-center gap-1.5">
          <Filter className="h-3 w-3" /> Quick Add
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => addPreset(p.rule)}
              className="rounded border border-[#2e3340] px-2.5 py-1 text-[11px] text-[#7a8aaa] hover:bg-[#1a2235] hover:text-[#dde4f0] hover:border-sky-500/30 transition-colors">
              + {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rule builder */}
      <Group group={value} onChange={onChange} />
    </div>
  );
}
