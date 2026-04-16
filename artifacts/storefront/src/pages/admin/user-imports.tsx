import { useEffect, useState, useCallback, useRef } from "react";
import { Upload, RefreshCw, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface ImportJob {
  id: number;
  filename: string;
  status: string;
  duplicatePolicy: string;
  totalRows: number;
  processedRows: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface ImportError {
  id: number;
  rowNumber: number;
  errorCode: string;
  errorMessage: string;
  rawData: Record<string, string> | null;
}

interface AvailableField { field: string; label: string; required: boolean; }

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  queued: "bg-blue-100 text-blue-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

export default function UserImportsPage() {
  const token = useAuthStore((s) => s.token);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [jobDetail, setJobDetail] = useState<{ job: ImportJob; errors: ImportError[] } | null>(null);
  const [fields, setFields] = useState<AvailableField[]>([]);
  const [preset, setPreset] = useState<Record<string, string>>({});
  const [showUpload, setShowUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Upload form state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvContent, setCsvContent] = useState("");
  const [filename, setFilename] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dupPolicy, setDupPolicy] = useState("skip");
  const [uploading, setUploading] = useState(false);

  const h = useCallback((opts?: RequestInit) => ({
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers },
  }), [token]);

  const loadJobs = useCallback(() => {
    fetch(`${API}/admin/imports`, h()).then((r) => r.json()).then(setJobs).catch(() => {});
  }, [h]);

  useEffect(() => {
    loadJobs();
    fetch(`${API}/admin/imports/meta/fields`, h()).then((r) => r.json()).then((d) => {
      if (d?.availableFields) setFields(d.availableFields);
      if (d?.woocommercePreset) setPreset(d.woocommercePreset);
    }).catch(() => {});
  }, [h, loadJobs]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) ?? "";
      setCsvContent(text);
      // Detect headers from first line
      const firstLine = text.split(/\r?\n/)[0] ?? "";
      const delim = (firstLine.match(/;/g) ?? []).length >= (firstLine.match(/,/g) ?? []).length ? ";" : ",";
      const headers = firstLine.split(delim).map((h) => h.replace(/^"|"$/g, "").trim());
      setCsvHeaders(headers);
      // Auto-apply WooCommerce preset
      const auto: Record<string, string> = {};
      for (const col of headers) { if (preset[col]) auto[col] = preset[col]; }
      setMapping(auto);
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!csvContent) return;
    setUploading(true);
    try {
      const r = await fetch(`${API}/admin/imports`, h({ method: "POST", body: JSON.stringify({ csvContent, filename, columnMapping: mapping, duplicatePolicy: dupPolicy }) }));
      const d = await r.json();
      if (!r.ok) { alert(d.error ?? "Upload failed"); return; }
      setShowUpload(false);
      setCsvContent(""); setCsvHeaders([]); setFilename(""); setMapping({});
      if (fileRef.current) fileRef.current.value = "";
      loadJobs();
    } finally {
      setUploading(false);
    }
  };

  const expand = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); setJobDetail(null); return; }
    setExpandedId(id);
    const r = await fetch(`${API}/admin/imports/${id}`, h());
    const d = await r.json();
    setJobDetail(d);
  };

  const deleteJob = async (id: number) => {
    if (!confirm("Delete this import job and its error log?")) return;
    await fetch(`${API}/admin/imports/${id}`, h({ method: "DELETE" }));
    loadJobs();
    if (expandedId === id) { setExpandedId(null); setJobDetail(null); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Import</h1>
          <p className="text-sm text-muted-foreground mt-1">Import customers from WooCommerce CSV exports. WordPress phpass password hashes are accepted and migrated to bcrypt transparently on first login.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadJobs} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
          <button onClick={() => setShowUpload(true)} className="flex items-center gap-1.5 rounded-md bg-blue-600 text-white px-3 py-1.5 text-sm hover:bg-blue-700"><Upload className="h-3.5 w-3.5" /> Import CSV</button>
        </div>
      </div>

      {/* Upload panel */}
      {showUpload && (
        <div className="rounded-lg border bg-white p-5 space-y-4">
          <h3 className="font-semibold">New Import</h3>
          <div>
            <label className="block text-sm font-medium mb-1">CSV File</label>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={onFileChange} className="block w-full text-sm border rounded-md px-3 py-2 cursor-pointer" />
          </div>
          {csvHeaders.length > 0 && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Column Mapping <span className="text-muted-foreground font-normal">(WooCommerce columns auto-detected)</span></label>
                <div className="space-y-1.5 max-h-64 overflow-y-auto border rounded-md p-3">
                  {csvHeaders.map((col) => (
                    <div key={col} className="flex items-center gap-3 text-sm">
                      <span className="w-44 truncate font-mono text-xs text-muted-foreground shrink-0">{col}</span>
                      <span className="text-muted-foreground">→</span>
                      <select value={mapping[col] ?? ""} onChange={(e) => setMapping((p) => ({ ...p, [col]: e.target.value }))} className="flex-1 rounded border px-2 py-1 text-xs">
                        <option value="">— skip —</option>
                        {fields.map((f) => <option key={f.field} value={f.field}>{f.label}{f.required ? " *" : ""}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-6 items-end">
                <div>
                  <label className="block text-sm font-medium mb-1">Duplicate Policy</label>
                  <select value={dupPolicy} onChange={(e) => setDupPolicy(e.target.value)} className="rounded border px-3 py-1.5 text-sm">
                    <option value="skip">Skip duplicates</option>
                    <option value="update">Update existing (no password overwrite)</option>
                    <option value="error">Error on duplicate</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowUpload(false); setCsvContent(""); setCsvHeaders([]); }} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">Cancel</button>
                  <button onClick={handleUpload} disabled={uploading || !Object.values(mapping).includes("email")} className="rounded-md bg-blue-600 text-white px-4 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-50">
                    {uploading ? "Uploading…" : "Start Import"}
                  </button>
                </div>
              </div>
              {!Object.values(mapping).includes("email") && <p className="text-xs text-red-500">Map at least one column to Email to proceed.</p>}
            </>
          )}
        </div>
      )}

      {/* Jobs table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6 text-center">No import jobs yet. Click "Import CSV" to get started.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left w-6"></th>
                <th className="px-4 py-2 text-left">File</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Rows</th>
                <th className="px-4 py-2 text-right">Success</th>
                <th className="px-4 py-2 text-right">Errors</th>
                <th className="px-4 py-2 text-right">Skipped</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {jobs.map((job) => (
                <>
                  <tr key={job.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2 cursor-pointer" onClick={() => expand(job.id)}>
                      {expandedId === job.id ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    </td>
                    <td className="px-4 py-2 max-w-[200px] truncate font-medium" title={job.filename}>{job.filename}</td>
                    <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[job.status] ?? "bg-gray-100 text-gray-700"}`}>{job.status}</span></td>
                    <td className="px-4 py-2 text-right tabular-nums">{job.totalRows}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-green-700">{job.successCount}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-red-600">{job.errorCount}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-yellow-700">{job.skippedCount}</td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{new Date(job.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      {(job.status === "completed" || job.status === "failed") && (
                        <button onClick={() => deleteJob(job.id)} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                    </td>
                  </tr>
                  {expandedId === job.id && jobDetail && (
                    <tr key={`${job.id}-detail`}>
                      <td colSpan={9} className="px-6 py-4 bg-muted/10 border-t">
                        {jobDetail.errors.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No errors recorded.</p>
                        ) : (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2">ERRORS ({jobDetail.errors.length})</p>
                            <div className="space-y-1 max-h-64 overflow-y-auto">
                              {jobDetail.errors.map((e) => (
                                <div key={e.id} className="flex gap-3 text-xs rounded bg-red-50 border border-red-100 px-3 py-1.5">
                                  <span className="font-mono text-muted-foreground w-14 shrink-0">Row {e.rowNumber}</span>
                                  <span className="font-medium text-red-700 shrink-0">{e.errorCode}</span>
                                  <span className="text-red-600">{e.errorMessage}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border bg-amber-50 border-amber-200 p-4 text-sm text-amber-800">
        <strong>Password handling:</strong> WooCommerce phpass hashes (<code className="font-mono text-xs">$P$...</code>) are stored as-is. On first login, the password is transparently re-hashed to bcrypt. Users keep their existing password — no reset required.
      </div>
    </div>
  );
}
