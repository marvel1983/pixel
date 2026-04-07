import { useState } from "react";
import { Copy, Check, Key, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface LicenseKey {
  id: number;
  value: string;
  status: string;
}

interface KeyGroup {
  orderItemId: number;
  productName: string;
  variantName: string;
  quantity: number;
  keys: LicenseKey[];
}

interface LicenseKeysDisplayProps {
  keyGroups: KeyGroup[];
}

export function LicenseKeysDisplay({ keyGroups }: LicenseKeysDisplayProps) {
  if (keyGroups.length === 0) return null;

  const hasAnyKeys = keyGroups.some((g) => g.keys.length > 0);

  if (!hasAnyKeys) {
    return (
      <div className="border rounded-lg p-5 bg-amber-50 border-amber-200">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-5 w-5 text-amber-600" />
          <h3 className="font-semibold text-amber-800">Keys Pending</h3>
        </div>
        <p className="text-sm text-amber-700">
          Your license keys are being prepared and will be delivered shortly.
          Check back in a few minutes or look for a delivery email.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Key className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Your License Keys</h3>
      </div>
      {keyGroups.map((group) => (
        <div key={group.orderItemId} className="border rounded-lg p-4">
          <p className="text-sm font-medium mb-1">{group.productName}</p>
          <p className="text-xs text-muted-foreground mb-3">{group.variantName}</p>
          {group.keys.length > 0 ? (
            <div className="space-y-2">
              {group.keys.map((k) => (
                <KeyRow key={k.id} licenseKey={k} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-amber-600 italic">Key pending delivery...</p>
          )}
        </div>
      ))}
    </div>
  );
}

function KeyRow({ licenseKey }: { licenseKey: LicenseKey }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(licenseKey.value);
      setCopied(true);
      toast({ title: "Key copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 bg-muted px-3 py-2 rounded text-xs font-mono select-all break-all">
        {licenseKey.value}
      </code>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0"
        onClick={handleCopy}
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
