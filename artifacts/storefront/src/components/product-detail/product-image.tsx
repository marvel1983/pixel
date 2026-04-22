import { useState } from "react";
import { Package, ZoomIn, X } from "lucide-react";

interface ProductImageProps {
  imageUrl: string | null;
  productName: string;
  additionalImages?: string[];
}

export function ProductImage({ imageUrl, productName, additionalImages = [] }: ProductImageProps) {
  const allImages = [imageUrl, ...additionalImages].filter(Boolean) as string[];
  const [selectedImage, setSelectedImage] = useState<string | null>(imageUrl);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <div>
        <div
          className="relative aspect-square bg-gradient-to-br from-muted to-muted/50 rounded-lg flex items-center justify-center cursor-zoom-in group"
          onClick={() => setLightboxOpen(true)}
        >
          {selectedImage ? (
            <img
              src={selectedImage}
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

        {additionalImages.length > 0 && (
          <div className="flex gap-2 mt-2 overflow-x-auto">
            {allImages.map((src, i) => (
              <button
                key={i}
                onClick={() => setSelectedImage(src)}
                className={`shrink-0 w-14 h-14 rounded border-2 transition-colors overflow-hidden bg-muted ${
                  selectedImage === src ? "border-primary" : "border-transparent hover:border-primary/50"
                }`}
              >
                <img src={src} alt={`${productName} thumbnail ${i + 1}`} className="w-full h-full object-contain p-1" />
              </button>
            ))}
          </div>
        )}
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
          <div className="max-w-3xl max-h-[80vh] bg-card rounded-lg p-8 flex items-center justify-center">
            {selectedImage ? (
              <img
                src={selectedImage}
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
