import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, Package, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MOCK_PRODUCTS } from "@/lib/mock-data";
import { searchProducts } from "@/lib/search-utils";
import type { SearchResponse, SearchProduct } from "@/lib/search-types";
import { useCurrencyStore } from "@/stores/currency-store";

const MAX_SUGGESTIONS = 6;
const DEBOUNCE_MS = 300;
const API_URL = import.meta.env.VITE_API_URL ?? "/api";

interface SuggestionItem {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  priceUsd: number;
  compareAtPriceUsd: number | null;
}

function apiItemToSuggestion(p: SearchProduct): SuggestionItem {
  const v = p.variants[0];
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    imageUrl: p.imageUrl,
    priceUsd: parseFloat(v?.priceUsd ?? "0"),
    compareAtPriceUsd: v?.compareAtPriceUsd
      ? parseFloat(v.compareAtPriceUsd)
      : null,
  };
}

export function SearchAutocomplete() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [, setLocation] = useLocation();
  const format = useCurrencyStore((s) => s.format);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setTotalCount(0);
      return;
    }

    timerRef.current = setTimeout(() => {
      const url = `${API_URL}/search?q=${encodeURIComponent(query.trim())}&limit=${MAX_SUGGESTIONS}`;
      fetch(url)
        .then((r) => r.json())
        .then((data: SearchResponse) => {
          const items = data.items.map(apiItemToSuggestion);
          setSuggestions(items);
          setTotalCount(data.total);
          if (items.length > 0) setIsOpen(true);
        })
        .catch(() => {
          const local = searchProducts(MOCK_PRODUCTS, query.trim());
          const items: SuggestionItem[] = local
            .slice(0, MAX_SUGGESTIONS)
            .map((p) => ({
              id: p.id,
              name: p.name,
              slug: p.slug,
              imageUrl: p.imageUrl,
              priceUsd: parseFloat(p.variants[0]?.priceUsd ?? "0"),
              compareAtPriceUsd: p.variants[0]?.compareAtPriceUsd
                ? parseFloat(p.variants[0].compareAtPriceUsd)
                : null,
            }));
          setSuggestions(items);
          setTotalCount(local.length);
          if (items.length > 0) setIsOpen(true);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timerRef.current);
  }, [query]);

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
      setSuggestions([]);
      inputRef.current?.blur();
      setLocation(`/product/${slug}`);
    },
    [setLocation],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (query.trim()) navigateToSearch(query.trim());
      return;
    }

    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIdx((prev) => (prev < suggestions.length ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIdx((prev) => (prev <= 0 ? suggestions.length : prev - 1));
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
          if (query.trim() && suggestions.length > 0) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen && suggestions.length > 0}
        aria-haspopup="listbox"
      />

      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <ul role="listbox" className="py-1">
            {suggestions.map((item, idx) => (
              <li
                key={item.id}
                role="option"
                aria-selected={idx === activeIdx}
                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                  idx === activeIdx ? "bg-primary/5" : "hover:bg-muted/50"
                }`}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  navigateToProduct(item.slug);
                }}
              >
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="h-5 w-5 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.name}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-bold text-foreground">
                    {format(item.priceUsd)}
                  </span>
                  {item.compareAtPriceUsd && (
                    <span className="block text-[10px] text-muted-foreground line-through">
                      {format(item.compareAtPriceUsd)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

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
              View all {totalCount} {totalCount === 1 ? "result" : "results"}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-primary" />
          </div>
        </div>
      )}
    </div>
  );
}
