import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, RotateCcw, Activity, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface CircuitInfo {
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  failures: number;
  lastFailureAt: number | null;
  lastStateChangeAt: number;
  lastSuccessAt: number | null;
  lastError: string | null;
}

const SERVICE_LABELS: Record<string, { label: string; description: string }> = {
  metenzi: { label: "Metenzi (Supplier)", description: "Product catalog and license key fulfillment" },
  checkout: { label: "Checkout.com (Payments)", description: "Payment processing and refunds" },
  trustpilot: { label: "Trustpilot (Reviews)", description: "Review invitation delivery" },
  mailchimp: { label: "Mailchimp (Newsletter)", description: "Newsletter subscriber sync" },
};

function stateColor(state: string) {
  if (state === "CLOSED") return "bg-green-100 text-green-800";
  if (state === "OPEN") return "bg-red-100 text-red-800";
  return "bg-yellow-100 text-yellow-800";
}

function StateIcon({ state }: { state: string }) {
  if (state === "CLOSED") return <CheckCircle2 className="h-5 w-5 text-green-600" />;
  if (state === "OPEN") return <AlertTriangle className="h-5 w-5 text-red-600" />;
  return <Clock className="h-5 w-5 text-yellow-600" />;
}

function formatTime(ts: number | null) {
  if (!ts) return "Never";
  return new Date(ts).toLocaleString();
}

export default function SystemStatusPage() {
  const token = useAuthStore((s) => s.token);
  const [circuits, setCircuits] = useState<Record<string, CircuitInfo>>({});
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState<string | null>(null);

  const fetchCircuits = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/admin/system-status/circuits`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCircuits(data.circuits);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchCircuits(); }, [fetchCircuits]);

  useEffect(() => {
    const interval = setInterval(fetchCircuits, 10_000);
    return () => clearInterval(interval);
  }, [fetchCircuits]);

  const resetCircuit = async (name: string) => {
    if (!token) return;
    setResetting(name);
    try {
      await fetch(`${API}/admin/system-status/circuits/${name}/reset`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      await fetchCircuits();
    } catch {
    } finally {
      setResetting(null);
    }
  };

  const openCount = Object.values(circuits).filter((c) => c.state === "OPEN").length;
  const halfOpenCount = Object.values(circuits).filter((c) => c.state === "HALF_OPEN").length;
  const allHealthy = openCount === 0 && halfOpenCount === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Status</h1>
          <p className="text-muted-foreground">External service circuit breaker status</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCircuits} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {!allHealthy && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="font-medium text-red-800">
              {openCount > 0 && `${openCount} service(s) unavailable`}
              {openCount > 0 && halfOpenCount > 0 && " · "}
              {halfOpenCount > 0 && `${halfOpenCount} service(s) recovering`}
            </span>
          </div>
        </div>
      )}

      {allHealthy && !loading && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="font-medium text-green-800">All external services are operational</span>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(circuits).map(([name, info]) => {
          const meta = SERVICE_LABELS[name] ?? { label: name, description: "" };
          return (
            <Card key={name} className={info.state === "OPEN" ? "border-red-300" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StateIcon state={info.state} />
                    <div>
                      <CardTitle className="text-base">{meta.label}</CardTitle>
                      <p className="text-xs text-muted-foreground">{meta.description}</p>
                    </div>
                  </div>
                  <Badge className={stateColor(info.state)}>{info.state.replace("_", " ")}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Failures:</span>{" "}
                    <span className="font-medium">{info.failures}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last success:</span>{" "}
                    <span className="font-medium text-xs">{formatTime(info.lastSuccessAt)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last failure:</span>{" "}
                    <span className="font-medium text-xs">{formatTime(info.lastFailureAt)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">State since:</span>{" "}
                    <span className="font-medium text-xs">{formatTime(info.lastStateChangeAt)}</span>
                  </div>
                </div>
                {info.lastError && (
                  <div className="rounded bg-gray-50 p-2">
                    <p className="text-xs text-muted-foreground">Last error:</p>
                    <p className="text-xs font-mono text-red-600 truncate">{info.lastError}</p>
                  </div>
                )}
                {info.state !== "CLOSED" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => resetCircuit(name)}
                    disabled={resetting === name}
                  >
                    <RotateCcw className={`mr-2 h-3 w-3 ${resetting === name ? "animate-spin" : ""}`} />
                    Reset Circuit
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            How Circuit Breakers Work
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p><strong>CLOSED</strong> — Normal operation. Requests pass through to the external service.</p>
          <p><strong>OPEN</strong> — Service is failing. Requests are rejected immediately with a fallback response to prevent cascade failures.</p>
          <p><strong>HALF OPEN</strong> — Testing recovery. A single request is allowed through to test if the service has recovered.</p>
        </CardContent>
      </Card>
    </div>
  );
}
