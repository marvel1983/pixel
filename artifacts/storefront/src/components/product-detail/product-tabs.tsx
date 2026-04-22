import { useState } from "react";
import DOMPurify from "dompurify";
import { CheckCircle2 } from "lucide-react";

interface ProductTabsProps {
  productName: string;
  platform: string;
  description?: string | null;
  keyFeatures?: string[];
  systemRequirements?: Record<string, string>;
}

const TABS = ["Description", "Key Features", "System Requirements"] as const;
type Tab = (typeof TABS)[number];

export function ProductTabs({ productName, platform, description, keyFeatures, systemRequirements }: ProductTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("Description");

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Tab nav */}
      <div className="flex border-b border-border bg-muted/40">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative px-5 py-3.5 text-sm font-semibold transition-colors ${
              activeTab === tab
                ? "text-primary bg-card after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6 bg-card min-h-[180px]">
        {activeTab === "Description" && (
          <DescriptionTab productName={productName} description={description} />
        )}
        {activeTab === "Key Features" && (
          <KeyFeaturesTab keyFeatures={keyFeatures} />
        )}
        {activeTab === "System Requirements" && (
          <SystemRequirementsTab platform={platform} systemRequirements={systemRequirements} />
        )}
      </div>
    </div>
  );
}

function DescriptionTab({ productName, description }: { productName: string; description?: string | null }) {
  if (description) {
    return (
      <div
        className="prose prose-sm max-w-none text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(description) }}
      />
    );
  }

  const bullets = [
    "Genuine license key delivered via email",
    "Step-by-step activation instructions",
    "24/7 customer support",
    "Lifetime license validity",
  ];

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Get your genuine <strong className="text-foreground">{productName}</strong> license key
        at the best price. Instant digital delivery — receive your activation key within minutes
        of purchase.
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        All keys sold on PixelCodes are 100% legitimate and sourced from authorized distributors.
        Each key comes with full activation support and lifetime validity.
      </p>
      <div>
        <p className="text-sm font-semibold text-foreground mb-3">What You Get</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {bullets.map((item) => (
            <div key={item} className="flex items-center gap-2.5 rounded-lg bg-muted/50 border border-border px-3 py-2.5">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <span className="text-sm text-foreground">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KeyFeaturesTab({ keyFeatures }: { keyFeatures?: string[] }) {
  if (!keyFeatures?.length) {
    return <p className="text-sm text-muted-foreground">No key features listed for this product.</p>;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {keyFeatures.map((f, i) => (
        <div key={i} className="flex items-start gap-2.5 rounded-lg bg-muted/50 border border-border px-3 py-2.5">
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span className="text-sm text-foreground">{f}</span>
        </div>
      ))}
    </div>
  );
}

function SystemRequirementsTab({ systemRequirements }: { platform: string; systemRequirements?: Record<string, string> }) {
  const entries = systemRequirements ? Object.entries(systemRequirements) : [];

  if (!entries.length) {
    return <p className="text-sm text-muted-foreground">No system requirements specified for this product.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border divide-y divide-border">
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[180px_1fr] text-sm">
          <div className="bg-muted/50 px-4 py-3 font-medium text-foreground border-r border-border">{key}</div>
          <div className="px-4 py-3 text-muted-foreground">{value}</div>
        </div>
      ))}
    </div>
  );
}
