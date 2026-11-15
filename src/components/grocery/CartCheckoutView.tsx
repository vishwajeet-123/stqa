import { useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  MapPin,
  Minus,
  Plus,
  ShieldAlert,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { apiRequest } from '../../api.ts';
import type { Address, CartData, Order, User } from '../../types.ts';
import { ImageWithFallback } from '../ImageWithFallback.tsx';

interface Props {
  user: User | null;
  cart: CartData;
  addresses: Address[];
  onOpenAuth: () => void;
  onRefreshCart: () => Promise<void>;
  onRefreshAddresses: () => Promise<void>;
  onOrderPlaced: (order: Order) => void;
  onBrowseProducts: () => void;
}

export function CartCheckoutView({
  user,
  cart,
  addresses,
  onOpenAuth,
  onRefreshCart,
  onRefreshAddresses,
  onOrderPlaced,
  onBrowseProducts,
}: Props) {
  const [step, setStep] = useState<'cart' | 'checkout' | 'confirmed'>('cart');
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    addresses.find((a) => a.isDefault)?._id || addresses[0]?._id || ''
  );
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [addrForm, setAddrForm] = useState({
    label: 'Home',
    recipientName: user?.name || '',
    phone: user?.phone || '',
    street: '',
    city: '',
    postalCode: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<string>('Test Card (Simulated)');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [idemKey, setIdemKey] = useState<string>(() => `ord-${Date.now()}`);

  if (!user) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-lg mx-auto">
        <ShoppingCart className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Sign in to view your shopping cart</h2>
        <p className="text-sm text-slate-500 mt-1">
          Your cart items, delivery addresses, and checkout validations are persisted per user in MongoDB.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="mt-5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg"
        >
          Sign In / Create Account
        </button>
      </div>
    );
  }

  const handleUpdateQty = async (productId: string, nextQty: number) => {
    setError('');
    setBusyId(productId);
    try {
      await apiRequest(`/api/cart/items/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity: nextQty }),
      });
      await onRefreshCart();
    } catch (err: any) {
      setError(err.message || 'Could not update quantity.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemoveItem = async (productId: string) => {
    setError('');
    setBusyId(productId);
    try {
      await apiRequest(`/api/cart/items/${productId}`, { method: 'DELETE' });
      await onRefreshCart();
    } catch (err: any) {
      setError(err.message || 'Could not remove item.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiRequest<{ address: Address }>('/api/addresses', {
        method: 'POST',
        body: JSON.stringify({ ...addrForm, isDefault: addresses.length === 0 }),
      });
      await onRefreshAddresses();
      setSelectedAddressId(res.address._id);
      setShowNewAddress(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save address.');
    }
  };

  const handlePlaceOrder = async () => {
    setError('');
    if (!selectedAddressId) {
      setError('Please select or add a delivery address before placing your order.');
      return;
    }
    setPlacing(true);
    try {
      const res = await apiRequest<{ order: Order }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          addressId: selectedAddressId,
          paymentMethod,
          idempotencyKey: idemKey,
        }),
      });
      setPlacedOrder(res.order);
      setStep('confirmed');
      setIdemKey(`ord-${Date.now()}`);
      await onRefreshCart();
      onOrderPlaced(res.order);
    } catch (err: any) {
      setError(err.message || 'Order placement failed.');
    } finally {
      setPlacing(false);
    }
  };

  if (step === 'confirmed' && placedOrder) {
    return (
      <div
        data-testid="order-confirmation"
        className="bg-white border border-slate-200 rounded-2xl p-8 max-w-2xl mx-auto"
      >
        <div className="flex items-center gap-3 text-emerald-700 mb-3">
          <CheckCircle2 className="w-7 h-7" />
          <h1 className="text-2xl font-bold text-slate-900">
            Order {placedOrder.orderNumber} Confirmed
          </h1>
        </div>
        <p className="text-sm text-slate-600">
          Status: <strong className="text-slate-900">{placedOrder.status}</strong> · Payment:{' '}
          <span>{placedOrder.paymentMethod}</span> ({placedOrder.paymentStatus})
        </p>

        <div className="mt-6 border-t border-b border-slate-200 py-4 space-y-2 text-sm">
          {placedOrder.items.map((item) => (
            <div key={item.productId} className="flex justify-between">
              <span className="text-slate-700">
                {item.name} × {item.quantity}
              </span>
              <span className="font-mono tabular-nums text-slate-900">
                ${item.subtotal.toFixed(2)}
              </span>
            </div>
          ))}
          <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-slate-900">
            <span>Total Paid (Simulated)</span>
            <span className="font-mono tabular-nums">${placedOrder.totalAmount.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setStep('cart');
              onBrowseProducts();
            }}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-lg mx-auto">
        <ShoppingCart className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Your cart is empty</h2>
        <p className="text-sm text-slate-500 mt-1">
          Add fresh produce, bakery items, or pantry staples from our stores.
        </p>
        <button
          type="button"
          onClick={onBrowseProducts}
          className="mt-5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg"
        >
          Browse Products
        </button>
      </div>
    );
  }

  const amountForFreeDelivery = Math.max(0, 35 - cart.subtotal);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {step === 'cart' ? 'Shopping Cart' : 'Checkout & Order Review'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {cart.store?.name} · {cart.itemCount} item(s)
          </p>
        </div>

        {step === 'checkout' && (
          <button
            type="button"
            onClick={() => setStep('cart')}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Back to Cart
          </button>
        )}
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          {step === 'cart' ? (
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
              {cart.items.map((item) => (
                <div key={item.productId} className="p-4 sm:p-5 flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                    <ImageWithFallback
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate">{item.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                      ${item.price.toFixed(2)} / {item.unit} · {item.stock} available
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="inline-flex items-center border border-slate-300 rounded-lg">
                        <button
                          type="button"
                          disabled={busyId === item.productId}
                          onClick={() => handleUpdateQty(item.productId, item.quantity - 1)}
                          className="p-1.5 text-slate-600 hover:text-slate-900"
                          aria-label="Decrease item quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-3 text-sm font-semibold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          data-testid="cart-qty-inc"
                          disabled={busyId === item.productId || item.quantity >= item.stock}
                          onClick={() => handleUpdateQty(item.productId, item.quantity + 1)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-40"
                          aria-label="Increase item quantity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={busyId === item.productId}
                        onClick={() => handleRemoveItem(item.productId)}
                        className="text-xs text-red-600 hover:text-red-800 inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="text-right font-mono font-bold text-slate-900 tabular-nums">
                    ${item.lineTotal.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Delivery Address Selection */}
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <h2 className="text-base font-bold text-slate-900">1. Select Delivery Address</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewAddress(!showNewAddress)}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    {showNewAddress ? 'Cancel' : '+ Add New Address'}
                  </button>
                </div>

                {showNewAddress && (
                  <form
                    onSubmit={handleSaveAddress}
                    className="mb-5 p-4 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-2 gap-3"
                  >
                    <input
                      type="text"
                      required
                      placeholder="Label (e.g. Home, Campus)"
                      value={addrForm.label}
                      onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Recipient Name"
                      value={addrForm.recipientName}
                      onChange={(e) => setAddrForm({ ...addrForm, recipientName: e.target.value })}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    />
                    <input
                      type="tel"
                      required
                      placeholder="Phone (10+ digits)"
                      value={addrForm.phone}
                      onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Street Address"
                      value={addrForm.street}
                      onChange={(e) => setAddrForm({ ...addrForm, street: e.target.value })}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    />
                    <input
                      type="text"
                      required
                      placeholder="City & State"
                      value={addrForm.city}
                      onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Postal Code"
                      value={addrForm.postalCode}
                      onChange={(e) => setAddrForm({ ...addrForm, postalCode: e.target.value })}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    />
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800"
                      >
                        Save Address
                      </button>
                    </div>
                  </form>
                )}

                {addresses.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No saved addresses found. Click "+ Add New Address" to continue.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {addresses.map((addr) => (
                      <label
                        key={addr._id}
                        className={`p-3.5 rounded-lg border cursor-pointer transition-colors ${
                          selectedAddressId === addr._id
                            ? 'border-emerald-600 bg-emerald-50/40'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="deliveryAddress"
                            checked={selectedAddressId === addr._id}
                            onChange={() => setSelectedAddressId(addr._id)}
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="font-semibold text-sm text-slate-900">{addr.label}</span>
                        </div>
                        <div className="text-xs text-slate-600 mt-1.5 pl-6">
                          <div>{addr.recipientName} · {addr.phone}</div>
                          <div>{addr.street}</div>
                          <div>{addr.city} {addr.postalCode}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Simulated Payment Gateway */}
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-base font-bold text-slate-900">
                    2. Payment Method (Academic Test Environment)
                  </h2>
                </div>

                <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                  <span>
                    <strong>Simulated Payment Gateway:</strong> For academic STQA testing only. Do not enter real credit/debit card numbers.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    'Test Card (Simulated)',
                    'Test UPI (Simulated)',
                    'Cash on Delivery (Test)',
                  ].map((method) => (
                    <label
                      key={method}
                      className={`p-3 rounded-lg border cursor-pointer text-sm flex items-center gap-2 ${
                        paymentMethod === method
                          ? 'border-emerald-600 bg-emerald-50/40 font-semibold text-slate-900'
                          : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === method}
                        onChange={() => setPaymentMethod(method)}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>{method}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Order Summary Column */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Order Summary</h2>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span data-testid="cart-subtotal" className="font-mono tabular-nums text-slate-900">
                ${cart.subtotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Delivery Fee</span>
              <span data-testid="cart-delivery-fee" className="font-mono tabular-nums text-slate-900">
                ${cart.deliveryFee.toFixed(2)}
              </span>
            </div>
            {amountForFreeDelivery > 0 ? (
              <p className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded-md">
                Add ${amountForFreeDelivery.toFixed(2)} more for free delivery ($35 threshold).
              </p>
            ) : (
              <p className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded-md">
                Free delivery unlocked ($35+ order).
              </p>
            )}
            <div className="pt-3 border-t border-slate-200 flex justify-between text-base font-bold text-slate-900">
              <span>Total</span>
              <span data-testid="cart-total" className="font-mono tabular-nums">
                ${cart.totalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {step === 'cart' ? (
            <button
              type="button"
              data-testid="checkout-btn"
              onClick={() => {
                if (!selectedAddressId && addresses.length > 0) {
                  setSelectedAddressId(addresses[0]._id);
                }
                setStep('checkout');
              }}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg transition-colors"
            >
              Proceed to Checkout
            </button>
          ) : (
            <button
              type="button"
              data-testid="place-order-btn"
              disabled={placing}
              onClick={handlePlaceOrder}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors"
            >
              {placing ? 'Validating & Placing Order...' : 'Place Order (Test Gateway)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
