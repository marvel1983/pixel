import { Monitor, Gamepad2, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ComponentType } from "react";

interface PlatformConfig {
  label: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  guideUrl: string;
  guideTitle: string;
}

const PLATFORM_MAP: Record<string, PlatformConfig> = {
  STEAM: { label: "Steam", icon: Gamepad2, color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200", guideUrl: "https://help.steampowered.com/en/faqs/view/2A12-9D79-C3D7-F870", guideTitle: "How to activate a Steam key" },
  ORIGIN: { label: "EA App", icon: Gamepad2, color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", guideUrl: "https://help.ea.com/en/help/ea-app/ea-app-get-help/redeem-a-code-in-the-ea-app/", guideTitle: "How to redeem a code in EA App" },
  UPLAY: { label: "Ubisoft", icon: Gamepad2, color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", guideUrl: "https://www.ubisoft.com/en-us/help/connectivity-and-performance/article/activating-a-key-on-ubisoft-connect/000077498", guideTitle: "How to activate on Ubisoft Connect" },
  GOG: { label: "GOG", icon: Gamepad2, color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", guideUrl: "https://support.gog.com/hc/en-us/articles/212159449", guideTitle: "How to redeem a GOG code" },
  EPIC: { label: "Epic Games", icon: Gamepad2, color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", guideUrl: "https://www.epicgames.com/help/en-US/c-Category_EpicGamesStore/c-EpicGamesStore_Codes", guideTitle: "How to redeem an Epic Games code" },
  BATTLENET: { label: "Battle.net", icon: Gamepad2, color: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200", guideUrl: "https://us.battle.net/support/en/article/26545", guideTitle: "How to redeem a Battle.net code" },
  MICROSOFT: { label: "Microsoft Store", icon: Monitor, color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200", guideUrl: "https://support.microsoft.com/en-us/account-billing/redeem-a-gift-card-or-code-d6b2c675-9b9f-f114-b05e-8b8f1a58c90f", guideTitle: "How to redeem a Microsoft key" },
  XBOX: { label: "Xbox", icon: Gamepad2, color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", guideUrl: "https://support.xbox.com/en-US/help/subscriptions-billing/redeem-codes-gifting/redeem-prepaid-codes", guideTitle: "How to redeem an Xbox code" },
  PLAYSTATION: { label: "PlayStation", icon: Gamepad2, color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", guideUrl: "https://www.playstation.com/en-us/support/store/redeem-ps-store-voucher-code/", guideTitle: "How to redeem a PlayStation code" },
  NINTENDO: { label: "Nintendo", icon: Gamepad2, color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", guideUrl: "https://en-americas-support.nintendo.com/app/answers/detail/a_id/22429", guideTitle: "How to redeem a Nintendo code" },
};

function getPlatformConfig(platformType: string | null | undefined): PlatformConfig | null {
  if (!platformType) return null;
  return PLATFORM_MAP[platformType] ?? null;
}

interface PlatformBadgeProps {
  platformType: string | null | undefined;
  compact?: boolean;
}

export function PlatformBadge({ platformType, compact }: PlatformBadgeProps) {
  const config = getPlatformConfig(platformType);
  if (!config) return null;
  const Icon = config.icon;
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-0.5 font-medium ${config.color}`}>
              <Icon className="h-2.5 w-2.5" /> {config.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[250px] text-xs">
            Activate on {config.label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium ${config.color}`}>
            <Icon className="h-4 w-4" />
            <span>{config.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[300px] text-xs">
          This product is activated through {config.label}. {config.guideTitle}.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface ActivationGuideLinkProps {
  platformType: string | null | undefined;
}

export function ActivationGuideLink({ platformType }: ActivationGuideLinkProps) {
  const config = getPlatformConfig(platformType);
  if (!config) return null;
  return (
    <a href={config.guideUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
      <Layers className="h-3.5 w-3.5" />
      {config.guideTitle}
    </a>
  );
}

export { PLATFORM_MAP, getPlatformConfig };
