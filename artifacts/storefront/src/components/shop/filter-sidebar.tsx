import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import type { ListingFilters } from "@/lib/use-listing-filters";

const CATEGORIES = [
  { slug: "operating-systems", label: "Operating Systems" },
  { slug: "office-productivity", label: "Office & Productivity" },
  { slug: "antivirus-security", label: "Antivirus & Security" },
  { slug: "games", label: "Games" },
  { slug: "servers-development", label: "Servers & Development" },
];

const PLATFORMS = [
  { value: "WINDOWS", label: "Windows" },
  { value: "MAC", label: "macOS" },
  { value: "LINUX", label: "Linux" },
  { value: "STEAM", label: "Steam" },
  { value: "EPIC", label: "Epic Games" },
  { value: "GOG", label: "GOG" },
];

interface FilterSidebarProps {
  filters: ListingFilters;
  onFilterChange: (update: Partial<ListingFilters>) => void;
  hideCategoryFilter?: boolean;
}

export function FilterSidebar({
  filters,
  onFilterChange,
  hideCategoryFilter,
}: FilterSidebarProps) {
  function toggleCategory(slug: string) {
    const cats = filters.categories.includes(slug)
      ? filters.categories.filter((c) => c !== slug)
      : [...filters.categories, slug];
    onFilterChange({ categories: cats });
  }

  function togglePlatform(value: string) {
    const plats = filters.platforms.includes(value)
      ? filters.platforms.filter((p) => p !== value)
      : [...filters.platforms, value];
    onFilterChange({ platforms: plats });
  }

  return (
    <aside className="w-full lg:w-56 shrink-0 space-y-5">
      {!hideCategoryFilter && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Categories
          </h3>
          <div className="space-y-2">
            {CATEGORIES.map((cat) => (
              <label
                key={cat.slug}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <Checkbox
                  checked={filters.categories.includes(cat.slug)}
                  onCheckedChange={() => toggleCategory(cat.slug)}
                />
                {cat.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <Separator />

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Platform
        </h3>
        <div className="space-y-2">
          {PLATFORMS.map((plat) => (
            <label
              key={plat.value}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <Checkbox
                checked={filters.platforms.includes(plat.value)}
                onCheckedChange={() => togglePlatform(plat.value)}
              />
              {plat.label}
            </label>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Price Range
        </h3>
        <Slider
          min={0}
          max={500}
          step={5}
          value={[filters.minPrice, Math.min(filters.maxPrice, 500)]}
          onValueChange={([min, max]) =>
            onFilterChange({ minPrice: min, maxPrice: max })
          }
          className="mb-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>${filters.minPrice}</span>
          <span>${Math.min(filters.maxPrice, 500)}+</span>
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <Label htmlFor="stock-toggle" className="text-sm">
          In Stock Only
        </Label>
        <Switch
          id="stock-toggle"
          checked={filters.inStockOnly}
          onCheckedChange={(v) => onFilterChange({ inStockOnly: v })}
        />
      </div>
    </aside>
  );
}
