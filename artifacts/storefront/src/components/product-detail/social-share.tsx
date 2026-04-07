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
        className="w-7 h-7 rounded-full border flex items-center justify-center hover:bg-muted transition-colors"
      >
        <Facebook className="h-3.5 w-3.5" />
      </a>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedName}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-7 h-7 rounded-full border flex items-center justify-center hover:bg-muted transition-colors"
      >
        <Twitter className="h-3.5 w-3.5" />
      </a>
      <button
        onClick={copyLink}
        className="w-7 h-7 rounded-full border flex items-center justify-center hover:bg-muted transition-colors"
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
