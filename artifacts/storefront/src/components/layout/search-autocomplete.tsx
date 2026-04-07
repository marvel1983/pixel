import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { Search, Package, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MOCK_PRODUCTS } from "@/lib/mock-data";
import { searchProducts } from "@/lib/search-utils";
import { useCurrencyStore } from "@/stores/currency-store";

const MAX_SUGGESTIONS = 6;
const DEBOUNCE_MS = 300;

export function SearchAutocomplete() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [, setLocation] = useLocation();
  const format = useCurrencyStore((s) => s.format);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timerRef.current = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const results = useMemo(
    () => searchProducts(MOCK_PRODUCTS, debouncedQuery),
    [debouncedQuery],
  );
  const suggestions = results.slice(0, MAX_SUGGESTIONS);
  const totalCount = results.length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navigateToSearch = useCallback(
    (q: string) => {
      setIsOpen(false);
      inputRef.current?.blur();
      setLocation(`/search?q=${encodeURIComponent(q)}`);
    },
    [setLocation],
  );

  const navigateToProduct = useCallback(
    (slug: string) => {
      setIsOpen(false);
      setQuery("");
      setDebouncedQuery("");
      inputRef.current?.blur();
      setLocation(`/product/${slug}`);
    },
    [setLocation],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "Enter" && query.trim()) {
        navigateToSearch(query.trim());
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIdx((prev) =>
          prev < suggestions.length ? prev + 1 : 0,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIdx((prev) => (prev <= 0 ? suggestions.length : prev - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIdx >= 0 && activeIdx < suggestions.length) {
          navigateToProduct(suggestions[activeIdx].slug);
        } else {
          navigateToSearch(query.trim());
        }
        break;
      case "Escape":
        setIsOpen(false);
        setActiveIdx(-1);
        break;
    }
  }

  return (
    <div ref={containerRef} className="flex-1 max-w-xl mx-auto relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
      <Input
        ref={inputRef}
        type="search"
        placeholder="Search for software, games, keys..."
        className="pl-9 h-10 bg-muted/50 border-border"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
          setActiveIdx(-1);
        }}
        onFocus={() => {
          if (query.trim()) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen && suggestions.length > 0}
        aria-haspopup="listbox"
      />

      {isOpen && debouncedQuery.trim() && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <ul role="listbox" className="py-1">
            {suggestions.map((product, idx) => {
              const variant = product.variants[0];
              const price = variant ? parseFloat(variant.priceUsd) : 0;
              const comparePrice = variant?.compareAtPriceUsd
                ? parseFloat(variant.compareAtPriceUsd)
                : null;

              return (
                <li
                  key={product.id}
                  role="option"
                  aria-selected={idx === activeIdx}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                    idx === activeIdx
                      ? "bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    navigateToProduct(product.slug);
                  }}
                >
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="h-5 w-5 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {product.categorySlug.replace(/-/g, " ")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-foreground">
                      {format(price)}
                    </span>
                    {comparePrice && (
                      <span className="block text-[10px] text-muted-foreground line-through">
                        {format(comparePrice)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {totalCount > MAX_SUGGESTIONS && (
            <div
              className={`border-t border-border px-3 py-2.5 cursor-pointer transition-colors flex items-center justify-center gap-1.5 ${
                activeIdx === suggestions.length
                  ? "bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
              onMouseEnter={() => setActiveIdx(suggestions.length)}
              onMouseDown={(e) => {
                e.preventDefault();
                navigateToSearch(query.trim());
              }}
            >
              <span className="text-sm text-primary font-medium">
                View all {totalCount} results
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-primary" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
