import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import {
  Address,
  Cart,
  Order,
  Product,
  Store,
  type OrderStatus,
  type UserRole,
} from '../models.ts';
import { recordAuditLog, requireAuth, requireRole, type AuthedRequest } from '../middleware/auth.ts';
import {
  calculateCartTotals,
  canTransitionOrderStatus,
  validatePhone,
} from '../utils/validation.ts';

export function createGroceryRouter(io: SocketIOServer) {
  const router = Router();

  // --- STORES ---
  router.get('/stores', async (req, res) => {
    try {
      const { search, onlyOpen } = req.query;
      const filter: Record<string, any> = {};
      if (onlyOpen === 'true') filter.isOpen = true;
      if (search && String(search).trim()) {
        const regex = new RegExp(String(search).trim(), 'i');
        filter.$or = [{ name: regex }, { description: regex }, { categoryFocus: regex }];
      }
      const stores = await Store.find(filter).sort({ rating: -1, name: 1 }).lean();
      return res.json({ stores });
    } catch {
      return res.status(500).json({ error: 'Failed to load stores.' });
    }
  });

  router.get('/stores/:id', async (req, res) => {
    try {
      const store = await Store.findById(req.params.id).lean();
      if (!store) return res.status(404).json({ error: 'Store not found.' });
      const products = await Product.find({ storeId: store._id }).sort({ isPopular: -1, name: 1 }).lean();
      return res.json({ store, products });
    } catch {
      return res.status(404).json({ error: 'Store not found.' });
    }
  });

  router.patch(
    '/stores/:id/toggle',
    requireAuth,
    requireRole('store_owner', 'qa_admin'),
    async (req: AuthedRequest, res) => {
      try {
        const store = await Store.findById(req.params.id);
        if (!store) return res.status(404).json({ error: 'Store not found.' });
        store.isOpen = !store.isOpen;
        await store.save();
        io.emit('store:updated', { storeId: String(store._id), isOpen: store.isOpen });
        return res.json({ store });
      } catch {
        return res.status(500).json({ error: 'Failed to update store status.' });
      }
    }
  );

  // --- PRODUCTS ---
  router.get('/products', async (req, res) => {
    try {
      const { search, category, storeId, popular } = req.query;
      const filter: Record<string, any> = {};
      if (category && category !== 'All') filter.category = String(category);
      if (storeId && storeId !== 'All') filter.storeId = String(storeId);
      if (popular === 'true') filter.isPopular = true;
      if (search && String(search).trim()) {
        const regex = new RegExp(String(search).trim(), 'i');
        filter.$or = [{ name: regex }, { description: regex }, { category: regex }];
      }

      const products = await Product.find(filter)
        .populate('storeId', 'name slug deliveryTimeMinutes deliveryFee isOpen')
        .sort({ isPopular: -1, createdAt: -1 })
        .lean();

      return res.json({ products });
    } catch {
      return res.status(500).json({ error: 'Failed to load products.' });
    }
  });

  router.get('/products/:id', async (req, res) => {
    try {
      const product = await Product.findById(req.params.id)
        .populate('storeId', 'name slug address deliveryTimeMinutes deliveryFee isOpen rating')
        .lean();
      if (!product) return res.status(404).json({ error: 'Product not found.' });
      return res.json({ product });
    } catch {
      return res.status(404).json({ error: 'Product not found.' });
    }
  });

  router.post(
    '/products',
    requireAuth,
    requireRole('store_owner', 'qa_admin'),
    async (req: AuthedRequest, res) => {
      try {
        const { storeId, name, description, category, price, unit, stock, imageUrl, isPopular } = req.body || {};
        if (!storeId || !name || !category || price == null || stock == null) {
          return res.status(400).json({ error: 'Store, name, category, price, and stock are required.' });
        }
        if (Number(price) <= 0 || Number(stock) < 0) {
          return res.status(400).json({ error: 'Price must be positive and stock cannot be negative.' });
        }

        const product = await Product.create({
          storeId,
          name: String(name).trim(),
          description: String(description || 'Fresh grocery item').trim(),
          category,
          price: Number(price),
          unit: String(unit || '1 unit').trim(),
          stock: Number(stock),
          imageUrl: imageUrl || '/src/assets/images/cat_fresh_produce_1794713615054.jpg',
          isAvailable: Number(stock) > 0,
          isPopular: Boolean(isPopular),
          isSeeded: false,
        });

        await recordAuditLog({
          actorId: req.user!.userId,
          actorName: req.user!.name,
          actorRole: req.user!.role,
          action: 'PRODUCT_CREATED',
          module: 'Products',
          entityType: 'Product',
          entityId: String(product._id),
          details: `Created product "${product.name}" (Stock: ${product.stock})`,
        });

        io.emit('inventory:updated', { productId: String(product._id), stock: product.stock });
        return res.status(201).json({ product });
      } catch {
        return res.status(500).json({ error: 'Failed to create product.' });
      }
    }
  );

  router.patch(
    '/products/:id',
    requireAuth,
    requireRole('store_owner', 'qa_admin'),
    async (req: AuthedRequest, res) => {
      try {
        const { price, stock, isAvailable, name, description } = req.body || {};
        const updates: Record<string, any> = {};
        if (price !== undefined) {
          if (Number(price) <= 0) return res.status(400).json({ error: 'Price must be greater than 0.' });
          updates.price = Number(price);
        }
        if (stock !== undefined) {
          if (Number(stock) < 0) return res.status(400).json({ error: 'Stock cannot be negative.' });
          updates.stock = Number(stock);
          updates.isAvailable = Number(stock) > 0;
        }
        if (isAvailable !== undefined) updates.isAvailable = Boolean(isAvailable);
        if (name) updates.name = String(name).trim();
        if (description) updates.description = String(description).trim();

        const product = await Product.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
        if (!product) return res.status(404).json({ error: 'Product not found.' });

        await recordAuditLog({
          actorId: req.user!.userId,
          actorName: req.user!.name,
          actorRole: req.user!.role,
          action: 'INVENTORY_UPDATED',
          module: 'Products',
          entityType: 'Product',
          entityId: String(product._id),
          details: `Updated "${product.name}": stock=${product.stock}, price=$${product.price}`,
        });

        io.emit('inventory:updated', {
          productId: String(product._id),
          stock: product.stock,
          isAvailable: product.isAvailable,
        });

        return res.json({ product });
      } catch {
        return res.status(500).json({ error: 'Failed to update product.' });
      }
    }
  );

  // --- HELPER: Build hydrated cart ---
  async function getHydratedCart(userId: string) {
    const cart = await Cart.findOne({ userId }).lean();
    if (!cart || cart.items.length === 0) {
      return {
        items: [],
        store: null,
        subtotal: 0,
        deliveryFee: 0,
        totalAmount: 0,
        itemCount: 0,
      };
    }

    const productIds = cart.items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds } })
      .populate('storeId', 'name deliveryFee deliveryTimeMinutes minOrderAmount isOpen')
      .lean();

    const productMap = new Map(products.map((p) => [String(p._id), p]));
    const hydratedItems = cart.items
      .map((item) => {
        const prod: any = productMap.get(String(item.productId));
        if (!prod) return null;
        return {
          productId: String(prod._id),
          storeId: String(prod.storeId?._id || prod.storeId),
          storeName: prod.storeId?.name || 'GroceryGo Store',
          name: prod.name,
          unit: prod.unit,
          price: prod.price,
          stock: prod.stock,
          isAvailable: prod.isAvailable,
          imageUrl: prod.imageUrl,
          quantity: item.quantity,
          lineTotal: Number((prod.price * item.quantity).toFixed(2)),
        };
      })
      .filter(Boolean) as any[];

    const firstProd: any = products[0];
    const storeDoc = firstProd?.storeId || null;
    const storeDeliveryFee = storeDoc?.deliveryFee ?? 2.99;
    const totals = calculateCartTotals(
      hydratedItems.map((i) => ({ price: i.price, quantity: i.quantity })),
      storeDeliveryFee
    );

    return {
      items: hydratedItems,
      store: storeDoc
        ? {
            _id: String(storeDoc._id),
            name: storeDoc.name,
            deliveryFee: storeDoc.deliveryFee,
            deliveryTimeMinutes: storeDoc.deliveryTimeMinutes,
            minOrderAmount: storeDoc.minOrderAmount,
          }
        : null,
      ...totals,
      itemCount: hydratedItems.reduce((acc, i) => acc + i.quantity, 0),
    };
  }

  // --- CART ---
  router.get('/cart', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const cart = await getHydratedCart(req.user!.userId);
      return res.json({ cart });
    } catch {
      return res.status(500).json({ error: 'Failed to load cart.' });
    }
  });

  router.post('/cart/items', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { productId, quantity = 1, replaceStore = false } = req.body || {};
      const qty = Number(quantity);
      if (!productId || !Number.isInteger(qty) || qty < 1) {
        return res.status(400).json({ error: 'Valid productId and positive integer quantity required.' });
      }

      const product = await Product.findById(productId);
      if (!product) return res.status(404).json({ error: 'Product not found.' });
      if (!product.isAvailable || product.stock <= 0) {
        return res.status(400).json({ error: `${product.name} is currently out of stock.` });
      }

      let cart = await Cart.findOne({ userId: req.user!.userId });
      if (!cart) {
        cart = new Cart({ userId: req.user!.userId, items: [] });
      }

      // Single-store checkout consistency check
      if (
        cart.items.length > 0 &&
        String(cart.items[0].storeId) !== String(product.storeId)
      ) {
        if (!replaceStore) {
          return res.status(409).json({
            code: 'DIFFERENT_STORE',
            error: 'Your cart contains items from another store. Clear cart to add from this store?',
          });
        }
        cart.items.splice(0, cart.items.length);
      }

      const existingIdx = cart.items.findIndex((i) => String(i.productId) === String(product._id));
      const desiredQty = existingIdx >= 0 ? cart.items[existingIdx].quantity + qty : qty;

      if (desiredQty > product.stock) {
        return res.status(400).json({
          error: `Insufficient stock for ${product.name}. Only ${product.stock} available.`,
        });
      }

      if (existingIdx >= 0) {
        cart.items[existingIdx].quantity = desiredQty;
      } else {
        cart.items.push({
          productId: product._id,
          storeId: product.storeId,
          quantity: desiredQty,
        });
      }

      await cart.save();
      const hydrated = await getHydratedCart(req.user!.userId);
      return res.json({ cart: hydrated });
    } catch {
      return res.status(500).json({ error: 'Failed to add item to cart.' });
    }
  });

  router.patch('/cart/items/:productId', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const qty = Number(req.body?.quantity);
      if (!Number.isInteger(qty) || qty < 0) {
        return res.status(400).json({ error: 'Quantity must be a non-negative integer.' });
      }

      const cart = await Cart.findOne({ userId: req.user!.userId });
      if (!cart) return res.status(404).json({ error: 'Cart is empty.' });

      if (qty === 0) {
        cart.items = cart.items.filter((i) => String(i.productId) !== req.params.productId) as any;
        await cart.save();
        const hydrated = await getHydratedCart(req.user!.userId);
        return res.json({ cart: hydrated });
      }

      const product = await Product.findById(req.params.productId);
      if (!product) return res.status(404).json({ error: 'Product not found.' });
      if (qty > product.stock) {
        return res.status(400).json({
          error: `Cannot set quantity to ${qty}. Only ${product.stock} in stock for ${product.name}.`,
        });
      }

      const item = cart.items.find((i) => String(i.productId) === req.params.productId);
      if (!item) return res.status(404).json({ error: 'Item not in cart.' });
      item.quantity = qty;
      await cart.save();

      const hydrated = await getHydratedCart(req.user!.userId);
      return res.json({ cart: hydrated });
    } catch {
      return res.status(500).json({ error: 'Failed to update cart item.' });
    }
  });

  router.delete('/cart/items/:productId', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const cart = await Cart.findOne({ userId: req.user!.userId });
      if (cart) {
        cart.items = cart.items.filter((i) => String(i.productId) !== req.params.productId) as any;
        await cart.save();
      }
      const hydrated = await getHydratedCart(req.user!.userId);
      return res.json({ cart: hydrated });
    } catch {
      return res.status(500).json({ error: 'Failed to remove item from cart.' });
    }
  });

  router.delete('/cart', requireAuth, async (req: AuthedRequest, res) => {
    try {
      await Cart.findOneAndUpdate({ userId: req.user!.userId }, { $set: { items: [] } });
      const hydrated = await getHydratedCart(req.user!.userId);
      return res.json({ cart: hydrated });
    } catch {
      return res.status(500).json({ error: 'Failed to clear cart.' });
    }
  });

  // --- ADDRESSES ---
  router.get('/addresses', requireAuth, async (req: AuthedRequest, res) => {
    const addresses = await Address.find({ userId: req.user!.userId }).sort({ isDefault: -1, createdAt: -1 }).lean();
    return res.json({ addresses });
  });

  router.post('/addresses', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { label, recipientName, phone, street, city, postalCode, isDefault } = req.body || {};
      if (!label || !recipientName || !phone || !street || !city || !postalCode) {
        return res.status(400).json({ error: 'All address fields are required.' });
      }
      if (!validatePhone(String(phone))) {
        return res.status(400).json({ error: 'Please provide a valid 10 to 15 digit phone number.' });
      }
      if (isDefault) {
        await Address.updateMany({ userId: req.user!.userId }, { $set: { isDefault: false } });
      }
      const address = await Address.create({
        userId: req.user!.userId,
        label: String(label).trim(),
        recipientName: String(recipientName).trim(),
        phone: String(phone).trim(),
        street: String(street).trim(),
        city: String(city).trim(),
        postalCode: String(postalCode).trim(),
        isDefault: Boolean(isDefault),
      });
      return res.status(201).json({ address });
    } catch {
      return res.status(500).json({ error: 'Failed to save address.' });
    }
  });

  router.put('/addresses/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { label, recipientName, phone, street, city, postalCode, isDefault } = req.body || {};
      if (!label || !recipientName || !phone || !street || !city || !postalCode) {
        return res.status(400).json({ error: 'All address fields are required.' });
      }
      if (!validatePhone(String(phone))) {
        return res.status(400).json({ error: 'Please provide a valid phone number.' });
      }
      if (isDefault) {
        await Address.updateMany({ userId: req.user!.userId }, { $set: { isDefault: false } });
      }
      const address = await Address.findOneAndUpdate(
        { _id: req.params.id, userId: req.user!.userId },
        {
          $set: {
            label: String(label).trim(),
            recipientName: String(recipientName).trim(),
            phone: String(phone).trim(),
            street: String(street).trim(),
            city: String(city).trim(),
            postalCode: String(postalCode).trim(),
            isDefault: Boolean(isDefault),
          },
        },
        { new: true }
      );
      if (!address) return res.status(404).json({ error: 'Address not found.' });
      return res.json({ address });
    } catch {
      return res.status(500).json({ error: 'Failed to update address.' });
    }
  });

  router.delete('/addresses/:id', requireAuth, async (req: AuthedRequest, res) => {
    await Address.deleteOne({ _id: req.params.id, userId: req.user!.userId });
    return res.json({ deleted: true });
  });

  // --- ORDERS ---
  router.post('/orders', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { addressId, deliveryAddress: inlineAddress, paymentMethod, idempotencyKey } = req.body || {};

      // Duplicate order prevention via idempotencyKey
      if (idempotencyKey) {
        const existingOrder = await Order.findOne({
          customerId: req.user!.userId,
          idempotencyKey: String(idempotencyKey),
        }).lean();
        if (existingOrder) {
          return res.status(200).json({ order: existingOrder, duplicatePrevented: true });
        }
      }

      const cart = await Cart.findOne({ userId: req.user!.userId });
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ error: 'Your cart is empty. Add items before placing an order.' });
      }

      let resolvedAddress: any = null;
      if (addressId) {
        resolvedAddress = await Address.findOne({ _id: addressId, userId: req.user!.userId }).lean();
      } else if (
        inlineAddress &&
        inlineAddress.recipientName &&
        inlineAddress.phone &&
        inlineAddress.street &&
        inlineAddress.city &&
        inlineAddress.postalCode
      ) {
        resolvedAddress = {
          label: inlineAddress.label || 'Delivery Address',
          recipientName: String(inlineAddress.recipientName).trim(),
          phone: String(inlineAddress.phone).trim(),
          street: String(inlineAddress.street).trim(),
          city: String(inlineAddress.city).trim(),
          postalCode: String(inlineAddress.postalCode).trim(),
        };
      }

      if (!resolvedAddress) {
        return res.status(400).json({ error: 'A valid delivery address is required to place an order.' });
      }

      const validPayments = [
        'Test Card (Simulated)',
        'Test UPI (Simulated)',
        'Cash on Delivery (Test)',
      ];
      if (!validPayments.includes(paymentMethod)) {
        return res.status(400).json({ error: 'Please select a valid simulated test payment method.' });
      }

      // Validate and atomically decrement stock for each item
      const storeId = cart.items[0].storeId;
      const store = await Store.findById(storeId).lean();
      if (!store) return res.status(404).json({ error: 'Store not found.' });
      if (!store.isOpen) {
        return res.status(400).json({ error: `${store.name} is currently closed for new orders.` });
      }

      const decremented: { productId: any; quantity: number }[] = [];
      const orderItems: any[] = [];

      for (const item of cart.items) {
        const updatedProduct = await Product.findOneAndUpdate(
          { _id: item.productId, stock: { $gte: item.quantity }, isAvailable: true },
          { $inc: { stock: -item.quantity } },
          { new: true }
        );

        if (!updatedProduct) {
          // Rollback previously decremented stock
          for (const prev of decremented) {
            await Product.findByIdAndUpdate(prev.productId, {
              $inc: { stock: prev.quantity },
              $set: { isAvailable: true },
            });
          }
          const prod = await Product.findById(item.productId).lean();
          return res.status(400).json({
            error: `Insufficient stock for "${prod?.name || 'item'}". Available: ${prod?.stock ?? 0}, Requested: ${item.quantity}.`,
          });
        }

        if (updatedProduct.stock === 0) {
          updatedProduct.isAvailable = false;
          await updatedProduct.save();
        }

        decremented.push({ productId: updatedProduct._id, quantity: item.quantity });
        orderItems.push({
          productId: updatedProduct._id,
          name: updatedProduct.name,
          unit: updatedProduct.unit,
          price: updatedProduct.price,
          quantity: item.quantity,
          subtotal: Number((updatedProduct.price * item.quantity).toFixed(2)),
        });
      }

      const totals = calculateCartTotals(
        orderItems.map((i) => ({ price: i.price, quantity: i.quantity })),
        store.deliveryFee
      );

      const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
      const initialStatus: OrderStatus = 'Order Placed – Awaiting Store Confirmation';

      const order = await Order.create({
        orderNumber,
        customerId: req.user!.userId,
        storeId: store._id,
        items: orderItems,
        deliveryAddress: {
          label: resolvedAddress.label,
          recipientName: resolvedAddress.recipientName,
          phone: resolvedAddress.phone,
          street: resolvedAddress.street,
          city: resolvedAddress.city,
          postalCode: resolvedAddress.postalCode,
        },
        paymentMethod,
        paymentStatus:
          paymentMethod === 'Cash on Delivery (Test)' ? 'COD Pending' : 'Simulated Paid',
        subtotal: totals.subtotal,
        deliveryFee: totals.deliveryFee,
        totalAmount: totals.totalAmount,
        status: initialStatus,
        statusHistory: [
          {
            status: initialStatus,
            updatedBy: req.user!.userId,
            updatedByName: req.user!.name,
            role: req.user!.role,
            note: 'Order placed via GroceryGo Checkout (Simulated Payment Gateway)',
            timestamp: new Date(),
          },
        ],
        idempotencyKey: idempotencyKey ? String(idempotencyKey) : null,
        isSeeded: false,
      });

      // Clear cart
      cart.items = [] as any;
      await cart.save();

      await recordAuditLog({
        actorId: req.user!.userId,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'ORDER_PLACED',
        module: 'Orders',
        entityType: 'Order',
        entityId: order.orderNumber,
        details: `Placed ${order.orderNumber} for $${order.totalAmount.toFixed(2)} at ${store.name}`,
      });

      const populatedOrder = await Order.findById(order._id)
        .populate('storeId', 'name address deliveryTimeMinutes')
        .populate('customerId', 'name email phone')
        .lean();

      io.emit('order:created', { order: populatedOrder });
      for (const dec of decremented) {
        io.emit('inventory:updated', { productId: String(dec.productId) });
      }

      return res.status(201).json({ order: populatedOrder });
    } catch (err) {
      console.error('[Orders] Place order error:', err);
      return res.status(500).json({ error: 'Failed to place order.' });
    }
  });

  // Get orders scoped by role
  router.get('/orders', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { role, userId } = req.user!;
      let filter: Record<string, any> = {};

      if (role === 'customer') {
        filter = { customerId: userId };
      } else if (role === 'store_owner') {
        const ownerStores = await Store.find({ ownerId: userId }).select('_id').lean();
        const storeIds = ownerStores.map((s) => s._id);
        filter = { storeId: { $in: storeIds } };
      } else if (role === 'delivery_partner') {
        filter = {
          $or: [
            { deliveryPartnerId: userId },
            { status: 'Items Packed – Ready for Pickup', deliveryPartnerId: null },
          ],
        };
      } else if (role === 'qa_admin') {
        filter = {};
      }

      const orders = await Order.find(filter)
        .populate('storeId', 'name address deliveryTimeMinutes')
        .populate('customerId', 'name email phone')
        .populate('deliveryPartnerId', 'name phone')
        .sort({ createdAt: -1 })
        .lean();

      return res.json({ orders });
    } catch {
      return res.status(500).json({ error: 'Failed to fetch orders.' });
    }
  });

  router.get('/orders/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const order = await Order.findById(req.params.id)
        .populate('storeId', 'name address deliveryTimeMinutes')
        .populate('customerId', 'name email phone')
        .populate('deliveryPartnerId', 'name phone')
        .lean();

      if (!order) return res.status(404).json({ error: 'Order not found.' });

      if (
        req.user!.role === 'customer' &&
        String((order.customerId as any)?._id || order.customerId) !== req.user!.userId
      ) {
        return res.status(403).json({ error: 'Forbidden: You can only view your own orders.' });
      }

      return res.json({ order });
    } catch {
      return res.status(404).json({ error: 'Order not found.' });
    }
  });

  // Update order status (role-gated state machine)
  router.patch('/orders/:id/status', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { status: nextStatus, note } = req.body || {};
      const order = await Order.findById(req.params.id);
      if (!order) return res.status(404).json({ error: 'Order not found.' });

      if (req.user!.role === 'customer' && String(order.customerId) !== req.user!.userId) {
        return res.status(403).json({ error: 'Forbidden: Cannot modify another customer order.' });
      }

      const check = canTransitionOrderStatus(
        order.status as OrderStatus,
        nextStatus as OrderStatus,
        req.user!.role as UserRole
      );
      if (!check.allowed) {
        return res.status(403).json({ error: check.reason });
      }

      // If Store Owner rejects or Customer cancels, restore product stock
      if (nextStatus === 'Rejected' || nextStatus === 'Cancelled') {
        for (const item of order.items) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.quantity },
            $set: { isAvailable: true },
          });
        }
        if (order.paymentStatus === 'Simulated Paid') {
          order.paymentStatus = 'Refunded (Simulated)';
        }
      }

      // If Delivery Partner accepts assignment
      if (
        req.user!.role === 'delivery_partner' &&
        nextStatus === 'Delivery Partner Assigned'
      ) {
        if (order.deliveryPartnerId && String(order.deliveryPartnerId) !== req.user!.userId) {
          return res.status(409).json({ error: 'Order already claimed by another delivery partner.' });
        }
        order.deliveryPartnerId = req.user!.userId as any;
      }

      order.status = nextStatus;
      order.statusHistory.push({
        status: nextStatus,
        updatedBy: req.user!.userId,
        updatedByName: req.user!.name,
        role: req.user!.role,
        note: note ? String(note).trim() : `Updated to ${nextStatus}`,
        timestamp: new Date(),
      } as any);

      await order.save();

      await recordAuditLog({
        actorId: req.user!.userId,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'ORDER_STATUS_UPDATED',
        module: nextStatus.includes('Delivery') ? 'Delivery' : 'Orders',
        entityType: 'Order',
        entityId: order.orderNumber,
        details: `${order.orderNumber} transitioned to "${nextStatus}"`,
      });

      const populatedOrder = await Order.findById(order._id)
        .populate('storeId', 'name address deliveryTimeMinutes')
        .populate('customerId', 'name email phone')
        .populate('deliveryPartnerId', 'name phone')
        .lean();

      io.emit('order:updated', { order: populatedOrder });

      return res.json({ order: populatedOrder });
    } catch (err) {
      console.error('[Orders] Update status error:', err);
      return res.status(500).json({ error: 'Failed to update order status.' });
    }
  });

  return router;
}
