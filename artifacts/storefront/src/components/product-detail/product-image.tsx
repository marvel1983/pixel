import { useState } from "react";
import { Package, ZoomIn, X } from "lucide-react";

interface ProductImageProps {
  imageUrl: string | null;
  productName: string;
}

export function ProductImage({ imageUrl, productName }: ProductImageProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <div
        className="relative aspect-square bg-gradient-to-br from-muted to-muted/50 rounded-lg flex items-center justify-center cursor-zoom-in group"
        onClick={() => setLightboxOpen(true)}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={productName}
            className="w-full h-full object-contain p-6"
          />
        ) : (
          <Package className="h-24 w-24 text-muted-foreground/30" />
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors rounded-lg flex items-center justify-center">
          <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-70 transition-opacity drop-shadow" />
        </div>
      </div>

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 text-white hover:text-white/80 z-10"
          >
            <X className="h-8 w-8" />
          </button>
          <div className="max-w-3xl max-h-[80vh] bg-white rounded-lg p-8 flex items-center justify-center">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={productName}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <Package className="h-48 w-48 text-muted-foreground/30" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
