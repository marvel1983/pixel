import { useState } from "react";
import { Package, ZoomIn, X, ChevronLeft, ChevronRight } from "lucide-react";

interface ProductImageProps {
  imageUrl: string | null;
  productName: string;
  additionalImages?: string[];
}

export function ProductImage({ imageUrl, productName, additionalImages = [] }: ProductImageProps) {
  const allImages = [imageUrl, ...additionalImages].filter(Boolean) as string[];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const selectedImage = allImages[selectedIdx] ?? null;
  const hasMultiple = allImages.length > 1;

  function prev() { setSelectedIdx((i) => (i - 1 + allImages.length) % allImages.length); }
  function next() { setSelectedIdx((i) => (i + 1) % allImages.length); }

  return (
    <>
      <div className="flex flex-col h-full space-y-3">
        {/* Main image — flex-1 so it fills remaining column height */}
        <div
          className="relative flex-1 min-h-[240px] border rounded-xl overflow-hidden bg-white cursor-zoom-in group"
          style={{ aspectRatio: undefined }}
          onClick={() => setLightboxOpen(true)}
        >
          {selectedImage ? (
            <img
              src={selectedImage}
              alt={productName}
              className="w-full h-full object-contain p-6 transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-20 w-20 text-muted-foreground/25" />
            </div>
          )}

          {/* Zoom overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/4 transition-colors duration-200 rounded-xl flex items-end justify-end p-3 pointer-events-none">
            <div className="flex items-center gap-1 rounded-lg bg-black/50 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn className="h-3.5 w-3.5 text-white" />
              <span className="text-[10px] text-white font-medium">Zoom</span>
            </div>
          </div>

          {/* Arrow nav for multiple images */}
          {hasMultiple && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-white/90 border border-border shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
              >
                <ChevronLeft className="h-4 w-4 text-foreground" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-white/90 border border-border shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
              >
                <ChevronRight className="h-4 w-4 text-foreground" />
              </button>
              {/* Image counter */}
              <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md tabular-nums">
                {selectedIdx + 1} / {allImages.length}
              </div>
            </>
          )}
        </div>

        {/* Thumbnail strip */}
        {hasMultiple && (
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(allImages.length, 4)}, 1fr)` }}>
            {allImages.map((src, i) => (
              <button
                key={i}
                onClick={() => setSelectedIdx(i)}
                className={`relative border-2 rounded-lg overflow-hidden bg-white transition-all duration-150 ${
                  i === selectedIdx
                    ? "border-primary shadow-sm shadow-primary/20"
                    : "border-border hover:border-primary/50"
                }`}
                style={{ aspectRatio: "1 / 1" }}
              >
                <img
                  src={src}
                  alt={`${productName} view ${i + 1}`}
                  className="w-full h-full object-contain p-1.5"
                />
                {i === selectedIdx && (
                  <div className="absolute inset-0 bg-primary/5 pointer-events-none rounded-lg" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {hasMultiple && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          <div
            className="max-w-2xl max-h-[80vh] bg-white rounded-xl p-6 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedImage ? (
              <img
                src={selectedImage}
                alt={productName}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <Package className="h-40 w-40 text-muted-foreground/25" />
            )}
          </div>

          {/* Dot indicators */}
          {hasMultiple && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
              {allImages.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setSelectedIdx(i); }}
                  className={`rounded-full transition-all duration-200 ${
                    i === selectedIdx ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/40 hover:bg-white/60"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
