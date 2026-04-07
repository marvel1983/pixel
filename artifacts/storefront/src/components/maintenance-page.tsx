import { useEffect, useState } from "react";
import { Wrench, Clock } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface MaintenanceInfo {
  maintenance: boolean;
  message: string;
  estimate: string | null;
}

export function useMaintenanceCheck() {
  const [info, setInfo] = useState<MaintenanceInfo | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch(`${API}/maintenance-status`)
      .then((r) => r.json())
      .then((d) => { setInfo(d); setChecked(true); })
      .catch(() => setChecked(true));
  }, []);

  return { info, checked };
}

export function MaintenancePage({ message, estimate }: { message: string; estimate?: string | null }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-50 mx-auto">
          <Wrench className="h-10 w-10 text-blue-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Under Maintenance</h1>
          <p className="text-muted-foreground">{message}</p>
        </div>
        {estimate && (
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-white border rounded-full px-4 py-2">
            <Clock className="h-4 w-4" />
            <span>Estimated: {estimate}</span>
          </div>
        )}
        <div className="pt-4">
          <div className="flex items-center justify-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm font-bold">PC</div>
            <span className="font-semibold text-gray-700">PixelCodes</span>
          </div>
        </div>
      </div>
    </div>
  );
}
