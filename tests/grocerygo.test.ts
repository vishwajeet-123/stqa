import { describe, expect, it } from 'vitest';
import {
  calculateCartTotals,
  canTransitionOrderStatus,
  validateEmail,
  validatePassword,
  validatePhone,
} from '../server/utils/validation.ts';

describe('GroceryGo Core Validation & Business Logic', () => {
  it('validates email addresses accurately', () => {
    expect(validateEmail('customer@grocerygo.demo')).toBe(true);
    expect(validateEmail('invalid-email')).toBe(false);
    expect(validateEmail('user@domain')).toBe(false);
  });

  it('validates phone numbers with 10-15 digits', () => {
    expect(validatePhone('9876543210')).toBe(true);
    expect(validatePhone('+1 (415) 555-0199')).toBe(true);
    expect(validatePhone('12345')).toBe(false);
  });

  it('enforces password strength rules', () => {
    expect(validatePassword('Demo@123').valid).toBe(true);
    expect(validatePassword('short').valid).toBe(false);
    expect(validatePassword('onlyletters').valid).toBe(false);
    expect(validatePassword('12345678').valid).toBe(false);
  });

  it('calculates cart subtotal, free delivery threshold, and total amount', () => {
    const underThreshold = calculateCartTotals([{ price: 10, quantity: 2 }], 2.99, 35);
    expect(underThreshold).toEqual({ subtotal: 20, deliveryFee: 2.99, totalAmount: 22.99 });

    const overThreshold = calculateCartTotals([{ price: 18, quantity: 2 }], 2.99, 35);
    expect(overThreshold).toEqual({ subtotal: 36, deliveryFee: 0, totalAmount: 36 });

    const empty = calculateCartTotals([], 2.99, 35);
    expect(empty).toEqual({ subtotal: 0, deliveryFee: 0, totalAmount: 0 });
  });

  it('enforces role-based order lifecycle transitions', () => {
    expect(
      canTransitionOrderStatus(
        'Order Placed – Awaiting Store Confirmation',
        'Store Accepted – Processing',
        'store_owner'
      ).allowed
    ).toBe(true);

    expect(
      canTransitionOrderStatus(
        'Order Placed – Awaiting Store Confirmation',
        'Delivered Successfully',
        'customer'
      ).allowed
    ).toBe(false);

    expect(
      canTransitionOrderStatus(
        'Items Packed – Ready for Pickup',
        'Delivery Partner Assigned',
        'delivery_partner'
      ).allowed
    ).toBe(true);

    expect(
      canTransitionOrderStatus(
        'Items Packed – Ready for Pickup',
        'Cancelled',
        'customer'
      ).allowed
    ).toBe(false);
  });
});
