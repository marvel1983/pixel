import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import type { ListingFilters } from "@/lib/use-listing-filters";
import type { Facets } from "@/lib/use-products";

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
  facets?: Facets;
  onFilterChange: (update: Partial<ListingFilters>) => void;
  hideCategoryFilter?: boolean;
}

export function FilterSidebar({ filters, facets = { tags: [], attributes: [] }, onFilterChange, hideCategoryFilter }: FilterSidebarProps) {
  function togglePlatform(value: string) {
    const plats = filters.platforms.includes(value)
      ? filters.platforms.filter((p) => p !== value)
      : [...filters.platforms, value];
    onFilterChange({ platforms: plats });
  }

  function toggleTag(slug: string) {
    const next = filters.tags.includes(slug)
      ? filters.tags.filter((t) => t !== slug)
      : [...filters.tags, slug];
    onFilterChange({ tags: next });
  }

  function toggleAttrOption(attrSlug: string, optSlug: string) {
    const current = filters.attrs[attrSlug] ?? [];
    const next = current.includes(optSlug)
      ? current.filter((s) => s !== optSlug)
      : [...current, optSlug];
    const newAttrs = { ...filters.attrs };
    if (next.length === 0) {
      delete newAttrs[attrSlug];
    } else {
      newAttrs[attrSlug] = next;
    }
    onFilterChange({ attrs: newAttrs });
  }

  return (
    <aside className="w-full lg:w-56 shrink-0 space-y-5">
      {/* Platform */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Platform</h3>
        <div className="space-y-2">
          {PLATFORMS.map((plat) => (
            <label key={plat.value} className="flex items-center gap-2 text-sm cursor-pointer">
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

      {/* Price Range */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Price Range</h3>
        <Slider
          min={0}
          max={500}
          step={5}
          value={[filters.minPrice, Math.min(filters.maxPrice, 500)]}
          onValueChange={([min, max]) => onFilterChange({ minPrice: min, maxPrice: max })}
          className="mb-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>${filters.minPrice}</span>
          <span>${Math.min(filters.maxPrice, 500)}+</span>
        </div>
      </div>

      <Separator />

      {/* In Stock */}
      <div className="flex items-center justify-between">
        <Label htmlFor="stock-toggle" className="text-sm">In Stock Only</Label>
        <Switch
          id="stock-toggle"
          checked={filters.inStockOnly}
          onCheckedChange={(v) => onFilterChange({ inStockOnly: v })}
        />
      </div>

      {/* Dynamic Tag facets */}
      {facets.tags.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Tags</h3>
            <div className="space-y-2">
              {facets.tags.map((tag) => (
                <label key={tag.slug} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={filters.tags.includes(tag.slug)}
                    onCheckedChange={() => toggleTag(tag.slug)}
                  />
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: tag.colorHex || "#3b82f6" }}
                  />
                  {tag.name}
                  <span className="ml-auto text-xs text-muted-foreground">{tag.count}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Dynamic Attribute facets */}
      {facets.attributes.map((attr) => (
        <div key={attr.slug}>
          <Separator />
          <div className="pt-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">{attr.name}</h3>
            <div className="space-y-2">
              {attr.options.map((opt) => (
                <label key={opt.slug} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={(filters.attrs[attr.slug] ?? []).includes(opt.slug)}
                    onCheckedChange={() => toggleAttrOption(attr.slug, opt.slug)}
                  />
                  {opt.colorHex && (
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0 border border-border"
                      style={{ backgroundColor: opt.colorHex }}
                    />
                  )}
                  {opt.value}
                  <span className="ml-auto text-xs text-muted-foreground">{opt.count}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      ))}
    </aside>
  );
}
