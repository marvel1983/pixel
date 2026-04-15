import { useState } from "react";
import { CheckCircle } from "lucide-react";

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

function KeyFeaturesTab({ keyFeatures }: { keyFeatures?: string[] }) {
  if (!keyFeatures || keyFeatures.length === 0) {
    return <p className="text-sm text-muted-foreground">No key features listed for this product.</p>;
  }
  return (
    <div className="space-y-2">
      {keyFeatures.map((f, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
          <span>{f}</span>
        </div>
      ))}
    </div>
  );
}

function SystemRequirementsTab({ platform, systemRequirements }: { platform: string; systemRequirements?: Record<string, string> }) {
  const entries = systemRequirements ? Object.entries(systemRequirements) : [];

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No system requirements specified for this product.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="text-sm">
          <span className="font-medium text-foreground">{key}:</span>{" "}
          <span className="text-muted-foreground">{value}</span>
        </div>
      ))}
    </div>
  );
}
