import { useState } from 'react';
import { Check, MapPin, Package, Plus, Store as StoreIcon, Truck, X } from 'lucide-react';
import { apiRequest } from '../../api.ts';
import type { Address, Order, Product, Store, User } from '../../types.ts';

interface StorePortalProps {
  user: User;
  stores: Store[];
  products: Product[];
  orders: Order[];
  onRefreshAll: () => Promise<void>;
}

export function StoreOwnerPortal({
  user,
  stores,
  products,
  orders,
  onRefreshAll,
}: StorePortalProps) {
  const [tab, setTab] = useState<'orders' | 'inventory'>('orders');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [newProd, setNewProd] = useState({
    storeId: stores[0]?._id || '',
    name: '',
    category: 'Fresh Produce',
    price: '4.50',
    unit: '500g',
    stock: '25',
    description: '',
  });
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});

  const myStores = stores.filter((s) => s.ownerId === user._id || user.role === 'qa_admin');
  const myStoreIds = new Set(myStores.map((s) => s._id));
  const myProducts = products.filter((p) => {
    const sid = typeof p.storeId === 'object' ? p.storeId._id : p.storeId;
    return myStoreIds.has(sid);
  });

  const handleOrderAction = async (orderId: string, status: string) => {
    setError('');
    setBusyId(orderId);
    try {
      await apiRequest(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await onRefreshAll();
    } catch (err: any) {
      setError(err.message || 'Failed to update order status.');
    } finally {
      setBusyId(null);
    }
  };

  const handleUpdateStock = async (productId: string, stockVal: number) => {
    setError('');
    setBusyId(productId);
    try {
      await apiRequest(`/api/products/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify({ stock: stockVal }),
      });
      await onRefreshAll();
    } catch (err: any) {
      setError(err.message || 'Failed to update stock.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiRequest('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          ...newProd,
          storeId: newProd.storeId || myStores[0]?._id,
          price: Number(newProd.price),
          stock: Number(newProd.stock),
        }),
      });
      setNewProd({
        storeId: myStores[0]?._id || '',
        name: '',
        category: 'Fresh Produce',
        price: '4.50',
        unit: '500g',
        stock: '25',
        description: '',
      });
      await onRefreshAll();
    } catch (err: any) {
      setError(err.message || 'Failed to add product.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Store Owner Operations Portal</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Accept or reject incoming orders, mark items packed, and manage live store stock
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setTab('orders')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tab === 'orders' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Incoming Orders ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('inventory')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tab === 'inventory' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Inventory ({myProducts.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {tab === 'orders' ? (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
              No store orders yet. Place an order as Customer to test Store fulfillment.
            </div>
          ) : (
            orders.map((ord) => (
              <div
                key={ord._id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-slate-900">{ord.orderNumber}</span>
                    <span className="text-xs font-semibold text-emerald-700">{ord.status}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Store: {typeof ord.storeId === 'object' ? ord.storeId.name : ''} · Total:{' '}
                    <span className="font-mono tabular-nums">${ord.totalAmount.toFixed(2)}</span> ·{' '}
                    {ord.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {ord.status === 'Order Placed – Awaiting Store Confirmation' && (
                    <>
                      <button
                        type="button"
                        disabled={busyId === ord._id}
                        onClick={() => handleOrderAction(ord._id, 'Store Accepted – Processing')}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Accept Order
                      </button>
                      <button
                        type="button"
                        disabled={busyId === ord._id}
                        onClick={() => handleOrderAction(ord._id, 'Rejected')}
                        className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </>
                  )}
                  {ord.status === 'Store Accepted – Processing' && (
                    <button
                      type="button"
                      disabled={busyId === ord._id}
                      onClick={() =>
                        handleOrderAction(ord._id, 'Items Packed – Ready for Pickup')
                      }
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                    >
                      <Package className="w-3.5 h-3.5" />
                      Mark Items Packed
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <form
            onSubmit={handleCreateProduct}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
          >
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <StoreIcon className="w-4 h-4 text-emerald-600" />
              Add New Store Product
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <select
                value={newProd.storeId}
                onChange={(e) => setNewProd({ ...newProd, storeId: e.target.value })}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {myStores.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="Product Name"
                value={newProd.name}
                onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <select
                value={newProd.category}
                onChange={(e) => setNewProd({ ...newProd, category: e.target.value })}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option>Fresh Produce</option>
                <option>Dairy & Bakery</option>
                <option>Pantry Staples</option>
                <option>Beverages</option>
                <option>Snacks & Frozen</option>
              </select>
              <input
                type="number"
                step="0.01"
                required
                placeholder="Price"
                value={newProd.price}
                onChange={(e) => setNewProd({ ...newProd, price: e.target.value })}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <input
                type="number"
                required
                placeholder="Stock"
                value={newProd.stock}
                onChange={(e) => setNewProd({ ...newProd, stock: e.target.value })}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Product
              </button>
            </div>
          </form>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">Product</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold text-right">Price</th>
                  <th className="py-3 px-4 font-semibold text-right">Stock</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {myProducts.map((p) => {
                  const val = stockDrafts[p._id] ?? String(p.stock);
                  return (
                    <tr key={p._id}>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{p.name}</td>
                      <td className="py-2.5 px-4 text-slate-500">{p.category}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        ${p.price.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <input
                          type="number"
                          min="0"
                          value={val}
                          onChange={(e) =>
                            setStockDrafts({ ...stockDrafts, [p._id]: e.target.value })
                          }
                          className="w-20 px-2 py-1 text-right font-mono text-sm border border-slate-300 rounded-md"
                        />
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          disabled={busyId === p._id}
                          onClick={() => handleUpdateStock(p._id, Number(val))}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md"
                        >
                          Save Stock
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function DeliveryPartnerPortal({
  orders,
  onRefreshOrders,
}: {
  orders: Order[];
  onRefreshOrders: () => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleTransition = async (orderId: string, status: string) => {
    setError('');
    setBusyId(orderId);
    try {
      await apiRequest(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await onRefreshOrders();
    } catch (err: any) {
      setError(err.message || 'Failed to update delivery status.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Delivery Partner Portal</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Claim packed orders ready for pickup and update live transit statuses
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          No deliveries ready for pickup or assigned to you right now.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((ord) => (
            <div
              key={ord._id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-slate-900">{ord.orderNumber}</span>
                  <span className="text-xs font-semibold text-emerald-700">{ord.status}</span>
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Pickup: {typeof ord.storeId === 'object' ? ord.storeId.name : ''} → Drop:{' '}
                  {ord.deliveryAddress.street}, {ord.deliveryAddress.city} ({ord.deliveryAddress.phone})
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {ord.status === 'Items Packed – Ready for Pickup' && (
                  <button
                    type="button"
                    disabled={busyId === ord._id}
                    onClick={() => handleTransition(ord._id, 'Delivery Partner Assigned')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    Accept Delivery
                  </button>
                )}
                {ord.status === 'Delivery Partner Assigned' && (
                  <button
                    type="button"
                    disabled={busyId === ord._id}
                    onClick={() => handleTransition(ord._id, 'Out for Delivery')}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
                  >
                    Mark Out for Delivery
                  </button>
                )}
                {ord.status === 'Out for Delivery' && (
                  <button
                    type="button"
                    disabled={busyId === ord._id}
                    onClick={() => handleTransition(ord._id, 'Delivered Successfully')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Mark Delivered
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProfileView({
  user,
  addresses,
  onRefreshAddresses,
  onUserUpdated,
  onOpenAuth,
}: {
  user: User | null;
  addresses: Address[];
  onRefreshAddresses: () => Promise<void>;
  onUserUpdated: (user: User) => void;
  onOpenAuth: () => void;
}) {
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  if (!user) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-lg mx-auto">
        <h2 className="text-lg font-bold text-slate-900">Sign in to manage your profile</h2>
        <button
          type="button"
          onClick={onOpenAuth}
          className="mt-4 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg"
        >
          Sign In
        </button>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      const res = await apiRequest<{ user: User }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name, phone }),
      });
      onUserUpdated(res.user);
      setMsg('Profile updated in MongoDB.');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Account Profile & Saved Addresses</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Role: <span className="font-mono text-slate-800">{user.role}</span> · {user.email}
        </p>
      </div>

      {msg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          {msg}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSaveProfile}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
      >
        <h2 className="text-base font-bold text-slate-900">Personal Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
        >
          Save Profile
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-900">Saved Delivery Addresses</h2>
        </div>
        {addresses.length === 0 ? (
          <p className="text-sm text-slate-500">No saved addresses yet.</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {addresses.map((addr) => (
              <div key={addr._id} className="py-3 flex items-center justify-between gap-4">
                <div className="text-sm">
                  <div className="font-semibold text-slate-900">
                    {addr.label} {addr.isDefault ? '(Default)' : ''}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {addr.recipientName} · {addr.phone} · {addr.street}, {addr.city}{' '}
                    {addr.postalCode}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await apiRequest(`/api/addresses/${addr._id}`, { method: 'DELETE' });
                    await onRefreshAddresses();
                  }}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
