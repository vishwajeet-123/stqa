import { useState } from 'react';
import { Search, ArrowRight, Plus, Clock, Star, ShoppingBag } from 'lucide-react';
import type { Product, Store } from '../../types.ts';
import { ImageWithFallback } from '../ImageWithFallback.tsx';

interface Props {
  stores: Store[];
  products: Product[];
  onSearchProducts: (query: string, category?: string) => void;
  onSelectStore: (store: Store) => void;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product, qty?: number) => Promise<void>;
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

export function GroceryHome({
  stores,
  products,
  onSearchProducts,
  onSelectStore,
  onSelectProduct,
  onAddToCart,
  addingProductId,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const popularProducts = products
    .filter((p) => (selectedCategory === 'All' ? true : p.category === selectedCategory))
    .slice(0, 6);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchProducts(searchQuery, selectedCategory);
  };

  return (
    <div className="space-y-10">
      {/* Storefront Hero Split */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-6 p-8 lg:p-10 flex flex-col justify-center">
          <p className="text-xs font-semibold text-emerald-700 tracking-wide mb-2">
            Fresh Neighborhood Delivery · Integrated QA Environment
          </p>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight text-balance">
            Farm-fresh groceries delivered to your door in under 30 minutes
          </h1>
          <p className="text-slate-600 mt-3 text-base leading-relaxed max-w-xl">
            Browse local organic markets, artisan bakeries, and everyday pantry staples. Every order is backed by live inventory checks and real-time six-stage delivery tracking.
          </p>

          <form onSubmit={handleSearchSubmit} className="mt-6 flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search avocados, sourdough, olive oil..."
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center justify-center gap-2"
            >
              Search Catalogue
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span>{stores.length} Partner Stores</span>
            <span aria-hidden="true">·</span>
            <span>{products.length} Live Products</span>
            <span aria-hidden="true">·</span>
            <span>Free delivery on orders $35+</span>
          </div>
        </div>

        <div className="lg:col-span-6 min-h-[260px] lg:min-h-[380px] bg-slate-100">
          <ImageWithFallback
            src="/src/assets/images/hero_grocery_produce_1794713614023.jpg"
            alt="Fresh organic produce, sourdough bread, and olive oil on a kitchen counter"
            className="w-full h-full object-cover"
          />
        </div>
      </section>

      {/* Featured Stores */}
      <section>
        <div className="flex items-end justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Featured Grocery Stores</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Select a local market to shop its dedicated inventory
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stores.map((store) => (
            <button
              key={store._id}
              type="button"
              onClick={() => onSelectStore(store)}
              className="text-left bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-emerald-400 hover:shadow-md transition-all group"
            >
              <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden">
                <ImageWithFallback
                  src={store.imageUrl}
                  alt={store.name}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-base text-slate-900 truncate">{store.name}</h3>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 tabular-nums shrink-0">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    {store.rating.toFixed(1)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{store.description}</p>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    {store.deliveryTimeMinutes} mins
                  </span>
                  <span>Fee ${store.deliveryFee.toFixed(2)}</span>
                  <span className={store.isOpen ? 'text-emerald-700 font-medium' : 'text-red-600 font-medium'}>
                    {store.isOpen ? 'Open Now' : 'Closed'}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Popular Products with Category Filter */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Popular Groceries</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Real-time stock synced with MongoDB store inventory
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {popularProducts.map((product) => {
            const storeName =
              typeof product.storeId === 'object' ? product.storeId.name : 'Partner Store';
            const outOfStock = !product.isAvailable || product.stock <= 0;
            return (
              <div
                key={product._id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col hover:border-slate-300 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onSelectProduct(product)}
                  className="aspect-[4/3] w-full bg-slate-100 overflow-hidden text-left"
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
                    onClick={() => onSelectProduct(product)}
                    className="text-left font-semibold text-base text-slate-900 mt-1 hover:text-emerald-700 transition-colors"
                  >
                    {product.name}
                  </button>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 flex-1">
                    {product.description}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
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
                      disabled={outOfStock || addingProductId === product._id}
                      onClick={() => onAddToCart(product, 1)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
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

        {popularProducts.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <ShoppingBag className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">No products in this category yet.</p>
          </div>
        )}
      </section>
    </div>
  );
}
