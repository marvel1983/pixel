import { useEffect, useRef } from "react";
import { Link } from "wouter";
import {
  Monitor,
  FileText,
  Shield,
  Gamepad2,
  Server,
} from "lucide-react";

const CATEGORIES = [
  { name: "Operating Systems", slug: "operating-systems", icon: Monitor },
  { name: "Office & Productivity", slug: "office-productivity", icon: FileText },
  { name: "Antivirus & Security", slug: "antivirus-security", icon: Shield },
  { name: "Games", slug: "games", icon: Gamepad2 },
  { name: "Servers & Development", slug: "servers-development", icon: Server },
];

interface CategoriesDropdownProps {
  onClose: () => void;
}

export function CategoriesDropdown({ onClose }: CategoriesDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 w-64 bg-popover rounded-lg shadow-lg border border-border z-[200] py-2"
    >
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        return (
          <Link
            key={cat.slug}
            href={`/category/${cat.slug}`}
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <Icon className="h-4 w-4 text-primary" />
            {cat.name}
          </Link>
        );
      })}
    </div>
  );
}
