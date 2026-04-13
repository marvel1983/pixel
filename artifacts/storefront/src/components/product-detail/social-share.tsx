import { Share2, Facebook, Twitter, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SocialShareProps {
  productName: string;
}

export function SocialShare({ productName }: SocialShareProps) {
  const { toast } = useToast();
  const url = typeof window !== "undefined" ? window.location.href : "";

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Link copied!" });
    });
  }

  const encodedUrl = encodeURIComponent(url);
  const encodedName = encodeURIComponent(productName);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Share2 className="h-3.5 w-3.5" />
        Share:
      </span>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
        style={{ backgroundColor: "#1877F2" }}
      >
        <Facebook className="h-3.5 w-3.5 text-white" />
      </a>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedName}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
        style={{ backgroundColor: "#000000" }}
      >
        <Twitter className="h-3.5 w-3.5 text-white" />
      </a>
      <button
        onClick={copyLink}
        className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity hover:opacity-80 bg-muted-foreground/20 hover:bg-muted-foreground/30"
      >
        <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
