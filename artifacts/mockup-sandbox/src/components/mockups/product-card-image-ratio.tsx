import { ShoppingCart, Star, Package } from "lucide-react";

const SAMPLE_PRODUCTS = [
  {
    name: "Microsoft Windows 10 Pro Retail KEY",
    price: "€8.50",
    rating: 5,
    reviews: 312,
    imageUrl: "https://placehold.co/400x533/1e3a5f/ffffff?text=Windows+10",
    stock: "In Stock",
  },
  {
    name: "Microsoft Office 2024 Professional Plus",
    price: "€24.90",
    rating: 4,
    reviews: 87,
    imageUrl: "https://placehold.co/400x533/d04a00/ffffff?text=Office+2024",
    stock: "In Stock",
  },
  {
    name: "Norton 360 for Gamers 3-Device 1-Year",
    price: "€13.95",
    rating: 4,
    reviews: 43,
    imageUrl: "https://placehold.co/400x533/1a7f37/ffffff?text=Norton+360",
    stock: "In Stock",
  },
];

function Card({ name, price, rating, reviews, imageUrl, stock, aspect }: {
  name: string; price: string; rating: number; reviews: number;
  imageUrl: string; stock: string; aspect: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className={`relative ${aspect} shrink-0 rounded-t-lg overflow-hidden bg-gray-100`}>
        <img
          src={imageUrl}
          alt={name}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100">
          <Package className="h-10 w-10 text-gray-300" />
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center p-3 text-center">
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">{name}</h3>
        <div className="flex items-center gap-1 mb-2">
          {[1,2,3,4,5].map(s => (
            <Star key={s} className={`h-3 w-3 ${s <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
          ))}
          <span className="text-[10px] text-gray-400">({reviews})</span>
        </div>
        <span className="text-xs text-green-600 mb-2">{stock}</span>
        <div className="mt-auto w-full space-y-2">
          <p className="text-lg font-bold text-gray-900">{price}</p>
          <button className="w-full bg-blue-600 text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 hover:bg-blue-700 transition-colors">
            <ShoppingCart className="h-3.5 w-3.5" /> Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductCardImageRatioPreview() {
  const options = [
    { label: "4 : 3  (current — landscape)", aspect: "aspect-[4/3]", note: "800 × 600 px" },
    { label: "3 : 4  (portrait — fits box art)", aspect: "aspect-[3/4]", note: "600 × 800 px" },
    { label: "1 : 1  (square)", aspect: "aspect-square", note: "600 × 600 px" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8 space-y-12 font-sans">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Product Card — Image Ratio Comparison</h1>
        <p className="text-sm text-gray-500">Same images, three different container aspect ratios. All use <code className="bg-gray-100 px-1 rounded">object-cover</code>.</p>
      </div>

      {options.map(({ label, aspect, note }) => (
        <section key={aspect}>
          <div className="flex items-baseline gap-3 mb-4">
            <h2 className="text-base font-semibold text-gray-800">{label}</h2>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono">{note}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 max-w-2xl">
            {SAMPLE_PRODUCTS.map((p) => (
              <Card key={p.name} {...p} aspect={aspect} />
            ))}
          </div>
        </section>
      ))}

      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-4">3 : 4 with <code className="bg-gray-100 px-1 rounded text-sm">object-contain</code> + white bg</h2>
        <p className="text-xs text-gray-500 mb-3">Full image always visible, no cropping — white letterbox fills gaps.</p>
        <div className="grid grid-cols-3 gap-4 max-w-2xl">
          {SAMPLE_PRODUCTS.map((p) => (
            <div key={p.name} className="bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
              <div className="relative aspect-[3/4] shrink-0 rounded-t-lg overflow-hidden bg-white">
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex flex-1 flex-col items-center p-3 text-center">
                <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">{p.name}</h3>
                <div className="flex items-center gap-1 mb-2">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} className={`h-3 w-3 ${s <= p.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                  ))}
                  <span className="text-[10px] text-gray-400">({p.reviews})</span>
                </div>
                <span className="text-xs text-green-600 mb-2">{p.stock}</span>
                <div className="mt-auto w-full space-y-2">
                  <p className="text-lg font-bold text-gray-900">{p.price}</p>
                  <button className="w-full bg-blue-600 text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5">
                    <ShoppingCart className="h-3.5 w-3.5" /> Add to Cart
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
