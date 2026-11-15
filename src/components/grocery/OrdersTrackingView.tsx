import { useState } from 'react';
import { CheckCircle2, Clock, Package, Truck, XCircle } from 'lucide-react';
import { apiRequest } from '../../api.ts';
import type { Order, User } from '../../types.ts';

interface Props {
  user: User | null;
  orders: Order[];
  selectedOrderId: string | null;
  onSelectOrderId: (id: string | null) => void;
  onRefreshOrders: () => Promise<void>;
  onOpenAuth: () => void;
}

const TRACKING_STAGES = [
  'Order Placed – Awaiting Store Confirmation',
  'Store Accepted – Processing',
  'Items Packed – Ready for Pickup',
  'Delivery Partner Assigned',
  'Out for Delivery',
  'Delivered Successfully',
];

export function OrdersTrackingView({
  user,
  orders,
  selectedOrderId,
  onSelectOrderId,
  onRefreshOrders,
  onOpenAuth,
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!user) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-lg mx-auto">
        <Package className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Sign in to view and track orders</h2>
        <p className="text-sm text-slate-500 mt-1">
          Order history and live six-stage delivery updates are synced via MongoDB and Socket.IO.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="mt-5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg"
        >
          Sign In
        </button>
      </div>
    );
  }

  const activeOrder = orders.find((o) => o._id === selectedOrderId) || orders[0] || null;

  const handleCancelOrder = async (orderId: string) => {
    setError('');
    setBusyId(orderId);
    try {
      await apiRequest(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Cancelled', note: 'Cancelled by customer' }),
      });
      await onRefreshOrders();
    } catch (err: any) {
      setError(err.message || 'Unable to cancel order.');
    } finally {
      setBusyId(null);
    }
  };

  const activeStageIndex = activeOrder ? TRACKING_STAGES.indexOf(activeOrder.status) : -1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Orders & Live Delivery Tracking</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Real-time order synchronization across Customer, Store Owner, and Delivery Partner
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          You have not placed any orders yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Orders List */}
          <div data-testid="my-orders-list" className="lg:col-span-5 space-y-3">
            {orders.map((ord) => {
              const storeName = typeof ord.storeId === 'object' ? ord.storeId.name : 'Store';
              const isSelected = activeOrder?._id === ord._id;
              const canCancel =
                user.role === 'customer' &&
                (ord.status === 'Order Placed – Awaiting Store Confirmation' ||
                  ord.status === 'Store Accepted – Processing');

              return (
                <div
                  key={ord._id}
                  onClick={() => onSelectOrderId(ord._id)}
                  className={`p-4 rounded-xl border bg-white cursor-pointer transition-all ${
                    isSelected
                      ? 'border-emerald-600 ring-1 ring-emerald-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {ord.orderNumber}
                    </span>
                    <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                      ${ord.totalAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {storeName} · {ord.items.length} item(s) ·{' '}
                    {new Date(ord.createdAt).toLocaleString()}
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        ord.status === 'Delivered Successfully'
                          ? 'text-emerald-700'
                          : ord.status === 'Cancelled' || ord.status === 'Rejected'
                          ? 'text-red-600'
                          : 'text-slate-800'
                      }`}
                    >
                      {ord.status}
                    </span>
                    {canCancel && (
                      <button
                        type="button"
                        disabled={busyId === ord._id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelOrder(ord._id);
                        }}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        {busyId === ord._id ? 'Cancelling...' : 'Cancel Order'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 6-Stage Order Tracker */}
          {activeOrder && (
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <div className="text-xs text-slate-500">Order Tracking Details</div>
                  <h2 className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                    {activeOrder.orderNumber}
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">
                    {typeof activeOrder.storeId === 'object' ? activeOrder.storeId.name : ''} →{' '}
                    {activeOrder.deliveryAddress.street}, {activeOrder.deliveryAddress.city}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">{activeOrder.paymentMethod}</div>
                  <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                    ${activeOrder.totalAmount.toFixed(2)}
                  </div>
                </div>
              </div>

              {activeOrder.status === 'Cancelled' || activeOrder.status === 'Rejected' ? (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-center gap-3 text-red-800 text-sm">
                  <XCircle className="w-5 h-5 shrink-0" />
                  <div>
                    <strong>Order {activeOrder.status}</strong> — Stock quantities were automatically
                    restored in MongoDB.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {TRACKING_STAGES.map((stage, idx) => {
                    const reached = activeStageIndex >= idx;
                    const isCurrent = activeStageIndex === idx;
                    const historyMatch = activeOrder.statusHistory.find((h) => h.status === stage);

                    return (
                      <div key={stage} className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {reached ? (
                            <CheckCircle2
                              className={`w-5 h-5 ${
                                isCurrent ? 'text-emerald-600' : 'text-emerald-500'
                              }`}
                            />
                          ) : (
                            <Clock className="w-5 h-5 text-slate-300" />
                          )}
                        </div>
                        <div className="flex-1 pb-3 border-b border-slate-100 last:border-none">
                          <div
                            className={`text-sm font-medium ${
                              reached ? 'text-slate-900' : 'text-slate-400'
                            }`}
                          >
                            {idx + 1}. {stage}
                          </div>
                          {historyMatch && (
                            <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                              {new Date(historyMatch.timestamp).toLocaleTimeString()} ·{' '}
                              {historyMatch.updatedByName} ({historyMatch.role})
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">Ordered Items</h3>
                <div className="bg-slate-50 border border-slate-200 rounded-lg divide-y divide-slate-200 text-sm">
                  {activeOrder.items.map((item) => (
                    <div key={item.productId} className="px-4 py-2.5 flex justify-between">
                      <span className="text-slate-700">
                        {item.name} ({item.unit}) × {item.quantity}
                      </span>
                      <span className="font-mono tabular-nums text-slate-900">
                        ${item.subtotal.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {typeof activeOrder.deliveryPartnerId === 'object' && activeOrder.deliveryPartnerId && (
                <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-xs text-emerald-900">
                  <Truck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    Assigned Delivery Partner: <strong>{activeOrder.deliveryPartnerId.name}</strong> (
                    {activeOrder.deliveryPartnerId.phone})
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
