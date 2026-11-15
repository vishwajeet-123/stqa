import { useState } from 'react';
import { ArrowLeft, Clock, MapPin, Plus, Search, Star } from 'lucide-react';
import type { Product, Store } from '../../types.ts';
import { ImageWithFallback } from '../ImageWithFallback.tsx';

interface Props {
  stores: Store[];
  products: Product[];
  selectedStore: Store | null;
  onSelectStore: (store: Store | null) => void;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product, qty?: number) => Promise<void>;
  addingProductId: string | null;
}

export function StoresView({
  stores,
  products,
  selectedStore,
  onSelectStore,
  onSelectProduct,
  onAddToCart,
  addingProductId,
}: Props) {
  const [search, setSearch] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);

  const filteredStores = stores.filter((s) => {
    if (onlyOpen && !s.isOpen) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.categoryFocus.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (selectedStore) {
    const storeProducts = products.filter((p) => {
      const sid = typeof p.storeId === 'object' ? p.storeId._id : p.storeId;
      return sid === selectedStore._id;
    });

    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => onSelectStore(null)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to All Stores
        </button>

        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row gap-6 items-start">
          <div className="w-full md:w-64 aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 shrink-0">
            <ImageWithFallback
              src={selectedStore.imageUrl}
              alt={selectedStore.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 data-testid="store-detail-title" className="text-2xl font-bold text-slate-900">
                {selectedStore.name}
              </h1>
              <span
                className={`text-xs font-semibold ${
                  selectedStore.isOpen ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {selectedStore.isOpen ? 'Open for Delivery' : 'Currently Closed'}
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-2">{selectedStore.description}</p>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-600 tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                {selectedStore.rating.toFixed(1)} Rating
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                {selectedStore.deliveryTimeMinutes} mins est.
              </span>
              <span>·</span>
              <span>Delivery Fee: ${selectedStore.deliveryFee.toFixed(2)}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {selectedStore.address}
              </span>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            Store Catalogue ({storeProducts.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {storeProducts.map((product) => {
              const outOfStock = !product.isAvailable || product.stock <= 0;
              return (
                <div
                  key={product._id}
                  data-testid="product-card"
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
                >
                  <button
                    type="button"
                    onClick={() => onSelectProduct(product)}
                    className="aspect-[4/3] w-full bg-slate-100 overflow-hidden"
                  >
                    <ImageWithFallback
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </button>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="text-xs text-slate-500">{product.category}</div>
                    <button
                      type="button"
                      onClick={() => onSelectProduct(product)}
                      className="text-left font-semibold text-base text-slate-900 mt-1 hover:text-emerald-700"
                    >
                      {product.name}
                    </button>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 flex-1">
                      {product.description}
                    </p>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="text-base font-bold text-slate-900 tabular-nums">
                          ${product.price.toFixed(2)}
                        </div>
                        <div className="text-xs text-slate-500 tabular-nums">
                          {product.unit} · {outOfStock ? 'Out of stock' : `${product.stock} left`}
                        </div>
                      </div>
                      <button
                        type="button"
                        data-testid="add-to-cart-btn"
                        disabled={outOfStock || addingProductId === product._id || !selectedStore.isOpen}
                        onClick={() => onAddToCart(product, 1)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add to Cart
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Grocery Stores & Supermarkets</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Explore verified neighborhood markets with live delivery times and fees
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stores..."
              className="pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={onlyOpen}
              onChange={(e) => setOnlyOpen(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Open Only
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredStores.map((store) => (
          <button
            key={store._id}
            type="button"
            data-testid="store-card"
            onClick={() => onSelectStore(store)}
            className="text-left bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-emerald-400 hover:shadow-md transition-all"
          >
            <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden">
              <ImageWithFallback
                src={store.imageUrl}
                alt={store.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-5">
              <div className="text-xs text-slate-500">{store.categoryFocus}</div>
              <div className="flex items-center justify-between mt-1">
                <h2 className="text-lg font-bold text-slate-900">{store.name}</h2>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 tabular-nums">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  {store.rating.toFixed(1)}
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-2 line-clamp-2">{store.description}</p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 tabular-nums">
                <span>{store.deliveryTimeMinutes} mins</span>
                <span>Fee ${store.deliveryFee.toFixed(2)}</span>
                <span className={store.isOpen ? 'text-emerald-700 font-semibold' : 'text-red-600 font-semibold'}>
                  {store.isOpen ? 'Open' : 'Closed'}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {filteredStores.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          No stores match your current filter.
        </div>
      )}
    </div>
  );
}
