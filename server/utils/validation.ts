import { ORDER_STATUSES, type OrderStatus, type UserRole } from '../models.ts';

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function validatePhone(phone: string): boolean {
  const digits = phone.replace(/[\s\-()+]/g, '');
  return /^\d{10,15}$/.test(digits);
}

export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters long.' };
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return { valid: false, message: 'Password must include at least one letter and one number.' };
  }
  return { valid: true };
}

export interface CartCalcItem {
  price: number;
  quantity: number;
}

export function calculateCartTotals(
  items: CartCalcItem[],
  storeDeliveryFee = 2.99,
  freeDeliveryThreshold = 35
): { subtotal: number; deliveryFee: number; totalAmount: number } {
  const subtotal = Number(
    items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0).toFixed(2)
  );
  if (subtotal <= 0) {
    return { subtotal: 0, deliveryFee: 0, totalAmount: 0 };
  }
  const deliveryFee = subtotal >= freeDeliveryThreshold ? 0 : Number(storeDeliveryFee.toFixed(2));
  const totalAmount = Number((subtotal + deliveryFee).toFixed(2));
  return { subtotal, deliveryFee, totalAmount };
}

export function canTransitionOrderStatus(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
  role: UserRole
): { allowed: boolean; reason?: string } {
  if (!ORDER_STATUSES.includes(nextStatus)) {
    return { allowed: false, reason: 'Invalid order status.' };
  }

  if (role === 'customer') {
    if (
      nextStatus === 'Cancelled' &&
      (currentStatus === 'Order Placed – Awaiting Store Confirmation' ||
        currentStatus === 'Store Accepted – Processing')
    ) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Customers can only cancel orders before items are packed.' };
  }

  if (role === 'store_owner') {
    if (
      currentStatus === 'Order Placed – Awaiting Store Confirmation' &&
      (nextStatus === 'Store Accepted – Processing' || nextStatus === 'Rejected')
    ) {
      return { allowed: true };
    }
    if (
      currentStatus === 'Store Accepted – Processing' &&
      nextStatus === 'Items Packed – Ready for Pickup'
    ) {
      return { allowed: true };
    }
    return { allowed: false, reason: `Store owners cannot transition from "${currentStatus}" to "${nextStatus}".` };
  }

  if (role === 'delivery_partner') {
    if (
      currentStatus === 'Items Packed – Ready for Pickup' &&
      nextStatus === 'Delivery Partner Assigned'
    ) {
      return { allowed: true };
    }
    if (
      currentStatus === 'Delivery Partner Assigned' &&
      nextStatus === 'Out for Delivery'
    ) {
      return { allowed: true };
    }
    if (
      currentStatus === 'Out for Delivery' &&
      nextStatus === 'Delivered Successfully'
    ) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Delivery partners cannot transition from "${currentStatus}" to "${nextStatus}".`,
    };
  }

  if (role === 'qa_admin') {
    return { allowed: true };
  }

  return { allowed: false, reason: 'Unauthorized role.' };
}
