import { useState } from 'react';
import { ArrowLeft, Minus, Plus, Search, PackageCheck, AlertCircle } from 'lucide-react';
import type { Product, Store } from '../../types.ts';
import { ImageWithFallback } from '../ImageWithFallback.tsx';

interface Props {
  products: Product[];
  stores: Store[];
  selectedProduct: Product | null;
  onSelectProduct: (product: Product | null) => void;
  initialSearch?: string;
  initialCategory?: string;
  onAddToCart: (product: Product, qty: number) => Promise<void>;
  addingProductId: string | null;
}

const CATEGORIES = [
  'All',
  'Fresh Produce',
  'Dairy & Bakery',
  'Pantry Staples',
  'Beverages',
  'Snacks & Frozen',
];

export function ProductsView({
  products,
  stores,
  selectedProduct,
  onSelectProduct,
  initialSearch = '',
  initialCategory = 'All',
  onAddToCart,
  addingProductId,
}: Props) {
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const [storeFilter, setStoreFilter] = useState('All');
  const [detailQty, setDetailQty] = useState(1);

  const filtered = products.filter((p) => {
    if (category !== 'All' && p.category !== category) return false;
    const sid = typeof p.storeId === 'object' ? p.storeId._id : p.storeId;
    if (storeFilter !== 'All' && sid !== storeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (selectedProduct) {
    const storeObj = typeof selectedProduct.storeId === 'object' ? selectedProduct.storeId : null;
    const outOfStock = !selectedProduct.isAvailable || selectedProduct.stock <= 0;

    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => {
            onSelectProduct(null);
            setDetailQty(1);
          }}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Products
        </button>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-6 bg-slate-100 aspect-[4/3] lg:aspect-auto lg:min-h-[420px]">
            <ImageWithFallback
              src={selectedProduct.imageUrl}
              alt={selectedProduct.name}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="lg:col-span-6 p-8 flex flex-col justify-center">
            <div className="text-xs font-medium text-emerald-700">
              {selectedProduct.category} · {storeObj?.name || 'GroceryGo Store'}
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mt-1">
              {selectedProduct.name}
            </h1>
            <p className="text-slate-600 mt-3 text-sm leading-relaxed">
              {selectedProduct.description}
            </p>

            <div className="mt-6 pt-6 border-t border-slate-200 flex items-baseline gap-3">
              <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
                ${selectedProduct.price.toFixed(2)}
              </span>
              <span className="text-sm text-slate-500">per {selectedProduct.unit}</span>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm">
              {outOfStock ? (
                <span className="inline-flex items-center gap-1.5 text-red-600 font-medium">
                  <AlertCircle className="w-4 h-4" />
                  Out of Stock
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium tabular-nums">
                  <PackageCheck className="w-4 h-4" />
                  In Stock — {selectedProduct.stock} units available
                </span>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="inline-flex items-center border border-slate-300 rounded-lg bg-white">
                <button
                  type="button"
                  onClick={() => setDetailQty((q) => Math.max(1, q - 1))}
                  className="p-2.5 text-slate-600 hover:text-slate-900"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-4 text-sm font-semibold tabular-nums">{detailQty}</span>
                <button
                  type="button"
                  onClick={() =>
                    setDetailQty((q) => Math.min(Math.max(1, selectedProduct.stock), q + 1))
                  }
                  className="p-2.5 text-slate-600 hover:text-slate-900"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                disabled={outOfStock || addingProductId === selectedProduct._id}
                onClick={() => onAddToCart(selectedProduct, detailQty)}
                className="flex-1 sm:flex-none px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-500 text-white font-semibold text-sm rounded-lg transition-colors whitespace-nowrap"
              >
                {addingProductId === selectedProduct._id
                  ? 'Adding to Cart...'
                  : `Add to Cart — $${(selectedProduct.price * detailQty).toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">All Grocery Products</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Search, filter by store or category, and inspect live stock availability
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              data-testid="product-search-input"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="All">All Stores</option>
            {stores.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto w-fit max-w-full">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              category === cat
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((product) => {
          const storeName =
            typeof product.storeId === 'object' ? product.storeId.name : 'Partner Store';
          const outOfStock = !product.isAvailable || product.stock <= 0;
          return (
            <div
              key={product._id}
              data-testid="product-card"
              className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
            >
              <button
                type="button"
                onClick={() => {
                  onSelectProduct(product);
                  setDetailQty(1);
                }}
                className="aspect-[4/3] w-full bg-slate-100 overflow-hidden"
              >
                <ImageWithFallback
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </button>
              <div className="p-4 flex-1 flex flex-col">
                <div className="text-xs text-slate-500">
                  {product.category} · {storeName}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSelectProduct(product);
                    setDetailQty(1);
                  }}
                  className="text-left font-semibold text-base text-slate-900 mt-1 hover:text-emerald-700"
                >
                  {product.name}
                </button>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2 flex-1">
                  {product.description}
                </p>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-base font-bold text-slate-900 tabular-nums">
                      ${product.price.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-500 tabular-nums">
                      {product.unit} · {outOfStock ? 'Out of stock' : `${product.stock} in stock`}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="add-to-cart-btn"
                    disabled={outOfStock || addingProductId === product._id}
                    onClick={() => onAddToCart(product, 1)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {addingProductId === product._id ? 'Adding...' : 'Add to Cart'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          No products matched your search criteria.
        </div>
      )}
    </div>
  );
}
