import { Globe, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const REGION_CONFIG: Record<string, { label: string; emoji: string; color: string; description: string }> = {
  GLOBAL: { label: "GLOBAL", emoji: "\u{1F30D}", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800", description: "This key can be activated worldwide without any regional restrictions." },
  EU: { label: "EU ONLY", emoji: "\u{1F1EA}\u{1F1FA}", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800", description: "This key can only be activated in European Union countries." },
  NA: { label: "NA ONLY", emoji: "\u{1F1FA}\u{1F1F8}", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800", description: "This key can only be activated in North America (US, Canada, Mexico)." },
  LATAM: { label: "LATAM", emoji: "\u{1F30E}", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-800", description: "This key can only be activated in Latin American countries." },
  ASIA: { label: "ASIA", emoji: "\u{1F30F}", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-200 dark:border-purple-800", description: "This key can only be activated in Asian countries." },
  RU: { label: "RU/CIS", emoji: "\u{1F1F7}\u{1F1FA}", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800", description: "This key can only be activated in Russia and CIS countries." },
  UK: { label: "UK ONLY", emoji: "\u{1F1EC}\u{1F1E7}", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800", description: "This key can only be activated in the United Kingdom." },
};

function getRegionInfo(regions: string[]) {
  if (!regions || regions.length === 0) return REGION_CONFIG.GLOBAL;
  if (regions.length === 1) return REGION_CONFIG[regions[0]] ?? { label: regions[0], emoji: "\u{1F30D}", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700", description: `This key is region-locked to ${regions[0]}.` };
  return { label: regions.join(", "), emoji: "\u{26A0}\u{FE0F}", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800", description: `This key can only be activated in: ${regions.join(", ")}.` };
}

interface RegionBadgeProps {
  regions: string[];
  compact?: boolean;
}

export function RegionBadge({ regions, compact }: RegionBadgeProps) {
  const info = getRegionInfo(regions);
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-0.5 font-medium ${info.color}`}>
              <Globe className="h-2.5 w-2.5" /> {info.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[250px] text-xs">
            {info.description}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium ${info.color}`}>
            <Globe className="h-4 w-4" />
            <span>{info.emoji} {info.label}</span>
            <Info className="h-3.5 w-3.5 opacity-60" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[300px] text-xs">
          {info.description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { getRegionInfo, REGION_CONFIG };
