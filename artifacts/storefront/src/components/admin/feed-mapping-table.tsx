import { Plus, Trash2 } from "lucide-react";

export interface FieldMapping { id: string; feedKey: string; sourceType: "attribute" | "static"; sourceValue: string; prefix: string; suffix: string }

function uid() { return Math.random().toString(36).slice(2, 9); }

interface Props {
  mappings: FieldMapping[];
  channelFields: { key: string; label: string; required?: boolean }[];
  productAttributes: { key: string; label: string }[];
  onChange: (mappings: FieldMapping[]) => void;
}

export function FeedMappingTable({ mappings, channelFields, productAttributes, onChange }: Props) {
  // Normalize any rows with empty feedKey (can happen when "Add Mapping Row" was clicked without selecting)
  const normalizedMappings = mappings.map((m) =>
    m.feedKey === "" && channelFields.length > 0 ? { ...m, feedKey: channelFields[0].key } : m,
  );
  const update = (id: string, patch: Partial<FieldMapping>) =>
    onChange(normalizedMappings.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const remove = (id: string) => onChange(normalizedMappings.filter((m) => m.id !== id));
  const add = (feedKey = "") => {
    const key = feedKey || channelFields[0]?.key || "";
    onChange([...normalizedMappings, { id: uid(), feedKey: key, sourceType: "attribute", sourceValue: productAttributes[0]?.key ?? "", prefix: "", suffix: "" }]);
  };

  const mappedKeys = new Set(normalizedMappings.map((m) => m.feedKey));
  const unmappedRequired = channelFields.filter((f) => f.required && !mappedKeys.has(f.key));

  const inp = "rounded border border-[#2e3340] bg-[#0c1018] px-2 py-1.5 text-[12px] text-[#dde4f0] focus:outline-none w-full";

  return (
    <div className="space-y-3">
      {unmappedRequired.length > 0 && (
        <div className="rounded border border-amber-500/40 bg-amber-900/20 px-3 py-2 text-[12px] text-amber-300">
          Required fields not mapped: {unmappedRequired.map((f) => f.key).join(", ")}
        </div>
      )}

      {/* Quick-add row from channel preset */}
      {channelFields.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {channelFields.filter((f) => !mappedKeys.has(f.key)).map((f) => (
            <button key={f.key} onClick={() => add(f.key)}
              className={`rounded border px-2 py-0.5 text-[11px] transition-colors ${f.required ? "border-amber-500/60 bg-amber-900/20 text-amber-300 hover:bg-amber-900/40" : "border-[#2e3340] text-[#5a6a84] hover:bg-[#1a2235] hover:text-[#dde4f0]"}`}>
              + {f.key}
            </button>
          ))}
        </div>
      )}

      {normalizedMappings.length > 0 && (
        <div className="overflow-x-auto rounded border border-[#2e3340]">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#1e2128]">
                {["Feed Field", "Source", "Value", "Prefix", "Suffix", ""].map((h) => (
                  <th key={h} className="border-b border-[#2a2e3a] px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-widest text-white">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {normalizedMappings.map((m, idx) => (
                <tr key={m.id} className={idx % 2 === 0 ? "bg-[#0c1018]" : "bg-[#0f1520]"}>
                  <td className="border-b border-[#1f2840] px-3 py-2">
                    {channelFields.length > 0 ? (
                      <select className={inp} value={m.feedKey} onChange={(e) => update(m.id, { feedKey: e.target.value })}>
                        {channelFields.map((f) => <option key={f.key} value={f.key}>{f.key}</option>)}
                        <option value="custom">custom...</option>
                      </select>
                    ) : (
                      <input className={inp} value={m.feedKey} onChange={(e) => update(m.id, { feedKey: e.target.value })} placeholder="field_key" />
                    )}
                  </td>
                  <td className="border-b border-[#1f2840] px-3 py-2">
                    <select className={inp} value={m.sourceType} onChange={(e) => update(m.id, { sourceType: e.target.value as "attribute" | "static" })}>
                      <option value="attribute">Attribute</option>
                      <option value="static">Static</option>
                    </select>
                  </td>
                  <td className="border-b border-[#1f2840] px-3 py-2">
                    {m.sourceType === "attribute" ? (
                      <select className={inp} value={m.sourceValue} onChange={(e) => update(m.id, { sourceValue: e.target.value })}>
                        {productAttributes.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                      </select>
                    ) : (
                      <input className={inp} value={m.sourceValue} onChange={(e) => update(m.id, { sourceValue: e.target.value })} placeholder="static value" />
                    )}
                  </td>
                  <td className="border-b border-[#1f2840] px-3 py-2">
                    <input className={`${inp} w-20`} value={m.prefix} onChange={(e) => update(m.id, { prefix: e.target.value })} placeholder="prefix" />
                  </td>
                  <td className="border-b border-[#1f2840] px-3 py-2">
                    <input className={`${inp} w-20`} value={m.suffix} onChange={(e) => update(m.id, { suffix: e.target.value })} placeholder="suffix" />
                  </td>
                  <td className="border-b border-[#1f2840] px-3 py-2">
                    <button onClick={() => remove(m.id)} className="rounded p-1 text-red-400 hover:bg-red-900/30 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button onClick={() => add()} className="flex items-center gap-1.5 rounded border border-[#2e3340] px-3 py-1.5 text-[12px] text-[#5a6a84] hover:bg-[#1a2235] hover:text-[#dde4f0] transition-colors">
        <Plus className="h-3.5 w-3.5" /> Add Mapping Row
      </button>
    </div>
  );
}
