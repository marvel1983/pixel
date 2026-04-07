import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save, Copy, Check, Monitor, Smartphone, Variable, Eye, Code, Type } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useAuthStore } from "@/stores/auth-store";
import { RichTextEditor } from "@/components/admin/rich-text-editor";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Template {
  id: number; key: string; name: string; subject: string;
  bodyHtml: string; variables: string[]; sampleData: Record<string, string>;
  isEnabled: boolean;
}

export default function EmailTemplateEditPage() {
  const token = useAuthStore((s) => s.token);
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const [template, setTemplate] = useState<Template | null>(null);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [sampleData, setSampleData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewSize, setPreviewSize] = useState<"desktop" | "mobile">("desktop");
  const [showSample, setShowSample] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"visual" | "source">("visual");
  const [sourceHtml, setSourceHtml] = useState("");
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchTemplate = useCallback(() => {
    fetch(`${API}/admin/email-templates/${params.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => {
        setTemplate(d.template);
        setSubject(d.template.subject);
        setBodyHtml(d.template.bodyHtml);
        setSourceHtml(d.template.bodyHtml);
        setSampleData(d.template.sampleData);
      }).catch(() => {});
  }, [token, params.id]);

  useEffect(() => { fetchTemplate(); }, [fetchTemplate]);

  const switchMode = (mode: "visual" | "source") => {
    if (mode === "source") {
      setSourceHtml(bodyHtml);
    } else {
      setBodyHtml(sourceHtml);
    }
    setEditorMode(mode);
  };

  const save = async () => {
    const html = editorMode === "source" ? sourceHtml : bodyHtml;
    setSaving(true);
    await fetch(`${API}/admin/email-templates/${params.id}`, { method: "PUT", headers, body: JSON.stringify({ subject, bodyHtml: html, sampleData }) });
    setSaving(false); setSaved(true);
    if (editorMode === "source") setBodyHtml(sourceHtml);
    else setSourceHtml(bodyHtml);
    setTimeout(() => setSaved(false), 2000);
  };

  const copyVar = (v: string) => {
    navigator.clipboard.writeText(`{{${v}}}`);
    setCopied(v); setTimeout(() => setCopied(null), 1500);
  };

  const currentHtml = editorMode === "source" ? sourceHtml : bodyHtml;

  const renderedSubject = useMemo(() => {
    if (!showSample) return subject;
    let s = subject;
    Object.entries(sampleData).forEach(([k, v]) => { s = s.replaceAll(`{{${k}}}`, v); });
    return s;
  }, [subject, sampleData, showSample]);

  const renderedHtml = useMemo(() => {
    let html = currentHtml;
    if (showSample) {
      Object.entries(sampleData).forEach(([k, v]) => { html = html.replaceAll(`{{${k}}}`, v); });
    }
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:24px;color:#1a1a1a;line-height:1.6;background:#f8f9fa}h1{color:#1a1a1a;font-size:22px}pre{background:#f1f3f5;padding:12px;border-radius:6px;font-size:14px}a{color:#2563eb}</style></head><body>${html}</body></html>`;
  }, [currentHtml, sampleData, showSample]);

  if (!template) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/email-templates")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-xl font-bold">{template.name}</h1>
            <Badge variant="outline" className="font-mono text-xs">{template.key}</Badge>
          </div>
        </div>
        <Button onClick={save} disabled={saving}>
          {saved ? <><Check className="mr-2 h-4 w-4" />Saved</> : saving ? "Saving..." : <><Save className="mr-2 h-4 w-4" />Save Changes</>}
        </Button>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-4">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Subject Line</CardTitle></CardHeader>
            <CardContent>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject..." />
              <p className="text-xs text-muted-foreground mt-1">Use {"{{variable}}"} syntax for dynamic content</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Email Body</CardTitle>
                <Tabs value={editorMode} onValueChange={(v) => switchMode(v as "visual" | "source")}>
                  <TabsList className="h-7">
                    <TabsTrigger value="visual" className="text-xs px-2 h-6"><Type className="h-3 w-3 mr-1" />Visual</TabsTrigger>
                    <TabsTrigger value="source" className="text-xs px-2 h-6"><Code className="h-3 w-3 mr-1" />HTML</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {editorMode === "visual" ? (
                <RichTextEditor content={bodyHtml} onChange={setBodyHtml} placeholder="Write your email content..." />
              ) : (
                <Textarea value={sourceHtml} onChange={(e) => setSourceHtml(e.target.value)} rows={16} className="font-mono text-xs" placeholder="<h1>Your Email</h1><p>Content here...</p>" />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Variable className="h-4 w-4" />Available Variables</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {template.variables.map((v) => (
                  <button key={v} onClick={() => copyVar(v)} className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-mono text-blue-700 hover:bg-blue-100 transition-colors">
                    {`{{${v}}}`}{copied === v ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3 opacity-50" />}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Sample Data</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {template.variables.map((v) => (
                <div key={v} className="flex items-center gap-2">
                  <Label className="w-32 text-xs font-mono shrink-0">{v}</Label>
                  <Input value={sampleData[v] ?? ""} onChange={(e) => setSampleData({ ...sampleData, [v]: e.target.value })} className="text-sm h-8" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4" />Preview</CardTitle>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch checked={showSample} onCheckedChange={setShowSample} className="scale-75" /><span>Sample data</span>
                  </div>
                  <Tabs value={previewSize} onValueChange={(v) => setPreviewSize(v as "desktop" | "mobile")}>
                    <TabsList className="h-7">
                      <TabsTrigger value="desktop" className="text-xs px-2 h-6"><Monitor className="h-3 w-3 mr-1" />Desktop</TabsTrigger>
                      <TabsTrigger value="mobile" className="text-xs px-2 h-6"><Smartphone className="h-3 w-3 mr-1" />Mobile</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded border bg-gray-100 p-2 mb-3">
                <p className="text-xs text-muted-foreground">Subject:</p>
                <p className="text-sm font-medium">{renderedSubject}</p>
              </div>
              <div className="flex justify-center bg-gray-100 rounded p-4">
                <iframe srcDoc={renderedHtml} title="Email Preview" className="border bg-white rounded shadow-sm" style={{ width: previewSize === "desktop" ? 600 : 375, height: 500 }} sandbox="" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
