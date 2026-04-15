import { useState } from "react";
import { Monitor, Cpu, CheckCircle } from "lucide-react";

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
    <div>
      <div className="flex border-b">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="py-5">
        {activeTab === "Description" && (
          <DescriptionTab productName={productName} description={description} />
        )}
        {activeTab === "Key Features" && (
          <KeyFeaturesTab productName={productName} keyFeatures={keyFeatures} />
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
        dangerouslySetInnerHTML={{ __html: description }}
      />
    );
  }
  return (
    <div className="prose prose-sm max-w-none text-muted-foreground">
      <p>
        Get your genuine {productName} license key at the best price.
        Instant digital delivery — receive your activation key within minutes of purchase.
      </p>
      <p>
        All keys sold on PixelCodes are 100% legitimate and sourced from authorized distributors.
        Each key comes with full activation support and lifetime validity.
      </p>
      <h4 className="text-foreground font-semibold mt-4 mb-2">What You Get</h4>
      <ul className="list-disc pl-5 space-y-1">
        <li>Genuine license key delivered via email</li>
        <li>Step-by-step activation instructions</li>
        <li>24/7 customer support</li>
        <li>Lifetime license validity</li>
      </ul>
    </div>
  );
}

function KeyFeaturesTab({ productName, keyFeatures }: { productName: string; keyFeatures?: string[] }) {
  const features = keyFeatures && keyFeatures.length > 0
    ? keyFeatures
    : [
        "Genuine digital license key",
        "Instant email delivery",
        "One-time purchase, lifetime use",
        "Full version — no restrictions",
        "Free updates included",
        "Multi-language support",
      ];
  return (
    <div className="space-y-2">
      {features.map((f, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
          <span>{f}</span>
        </div>
      ))}
    </div>
  );
}

function SystemRequirementsTab({ platform, systemRequirements }: { platform: string; systemRequirements?: Record<string, string> }) {
  const hasCustomReqs = systemRequirements && Object.keys(systemRequirements).length > 0;

  if (hasCustomReqs) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Object.entries(systemRequirements).map(([key, value]) => (
          <div key={key} className="text-sm">
            <dt className="font-medium text-foreground inline">{key}:</dt>{" "}
            <dd className="inline text-muted-foreground">{value}</dd>
          </div>
        ))}
      </div>
    );
  }

  const isWindows = platform === "WINDOWS";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-3">
        <h4 className="font-semibold text-sm flex items-center gap-1.5">
          <Monitor className="h-4 w-4" /> Minimum
        </h4>
        <dl className="text-sm space-y-1.5 text-muted-foreground">
          <div><dt className="font-medium text-foreground inline">OS:</dt> {isWindows ? "Windows 10 (64-bit)" : "macOS 12+"}</div>
          <div><dt className="font-medium text-foreground inline">Processor:</dt> 1 GHz dual-core</div>
          <div><dt className="font-medium text-foreground inline">RAM:</dt> 4 GB</div>
          <div><dt className="font-medium text-foreground inline">Storage:</dt> 4 GB available</div>
        </dl>
      </div>
      <div className="space-y-3">
        <h4 className="font-semibold text-sm flex items-center gap-1.5">
          <Cpu className="h-4 w-4" /> Recommended
        </h4>
        <dl className="text-sm space-y-1.5 text-muted-foreground">
          <div><dt className="font-medium text-foreground inline">OS:</dt> {isWindows ? "Windows 11 (64-bit)" : "macOS 14+"}</div>
          <div><dt className="font-medium text-foreground inline">Processor:</dt> 2 GHz quad-core</div>
          <div><dt className="font-medium text-foreground inline">RAM:</dt> 8 GB</div>
          <div><dt className="font-medium text-foreground inline">Storage:</dt> 10 GB available (SSD)</div>
        </dl>
      </div>
    </div>
  );
}
