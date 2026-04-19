import { useState } from "react";
import { Copy, Check, Key, Clock, CopyCheck } from "lucide-react";
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
  instructions?: string | null;
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
      <div className="border rounded-lg p-5 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <h3 className="font-semibold text-amber-800 dark:text-amber-300">Keys Pending</h3>
        </div>
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Your license keys are being prepared and will be delivered shortly.
          Check back in a few minutes or look for a delivery email.
        </p>
      </div>
    );
  }

  const allKeys = keyGroups.flatMap((g) => g.keys.map((k) => k.value));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Your License Keys</h3>
        </div>
        {allKeys.length > 1 && <CopyAllButton keys={allKeys} />}
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
          {group.instructions && group.keys.length > 0 && (
            <div className="mt-3 rounded-md border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-600 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-400 mb-1.5">How to activate</p>
              <div
                className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed [&_a]:underline [&_a]:text-blue-600 [&_ol]:list-decimal [&_ol]:pl-4 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:mt-0.5"
                dangerouslySetInnerHTML={{ __html: group.instructions }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CopyAllButton({ keys }: { keys: string[] }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  async function handleCopyAll() {
    try {
      await navigator.clipboard.writeText(keys.join("\n"));
      setCopied(true);
      toast({ title: `${keys.length} keys copied to clipboard` });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleCopyAll} className="gap-2">
      {copied ? <CopyCheck className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied!" : "Copy All"}
    </Button>
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
