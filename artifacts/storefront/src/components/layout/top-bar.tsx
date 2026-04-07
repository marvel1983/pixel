import { Search, Headset, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";

export function TopBar() {
  return (
    <div className="w-full bg-white border-b border-border">
      <div className="container mx-auto px-4 py-3 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">PC</span>
          </div>
          <span className="text-xl font-bold text-foreground hidden sm:block">
            PixelCodes
          </span>
        </Link>

        <div className="flex-1 max-w-xl mx-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search for software, games, keys..."
            className="pl-9 h-10 bg-muted/50 border-border"
          />
        </div>

        <div className="hidden lg:flex items-center gap-6 shrink-0 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Headset className="h-4 w-4 text-primary" />
            <span>24/7 Support</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <span>Worldwide Delivery</span>
          </div>
        </div>
      </div>
    </div>
  );
}
