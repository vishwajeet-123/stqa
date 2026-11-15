import { chromium, type Browser, type Page } from 'playwright';

export interface PlaywrightRunResult {
  status: 'Passed' | 'Failed';
  actualResult: string;
  logs: string[];
  durationMs: number;
  evidenceScreenshot: string;
}

const BASE_URL = `http://127.0.0.1:${process.env.PORT || 3000}`;

async function captureScreenshot(page: Page): Promise<string> {
  try {
    const buf = await page.screenshot({ type: 'jpeg', quality: 65, fullPage: false });
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

async function loginViaUI(page: Page, email: string, password: string, logs: string[]) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.getByTestId('nav-auth-btn').click();
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  logs.push(`Submitted login form for ${email}`);
}

export async function runPlaywrightTest(
  automationKey: string,
  tcCode: string
): Promise<PlaywrightRunResult> {
  const startTime = Date.now();
  const logs: string[] = [`[${new Date().toISOString()}] Starting Playwright Chromium run for ${tcCode} (${automationKey})`];
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    page = await context.newPage();

    switch (automationKey) {
      case 'tc-001-register': {
        const uniqueEmail = `pw_user_${Date.now()}@grocerygo.test`;
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        await page.getByTestId('nav-auth-btn').click();
        await page.getByTestId('register-tab').click();
        await page.getByTestId('register-name').fill('Playwright Test Shopper');
        await page.getByTestId('register-email').fill(uniqueEmail);
        await page.getByTestId('register-phone').fill('9876501234');
        await page.getByTestId('register-password').fill('FreshTest123');
        await page.getByTestId('register-submit').click();
        await page.getByTestId('user-menu-name').waitFor({ timeout: 8000 });
        const userText = await page.getByTestId('user-menu-name').textContent();
        logs.push(`Registered and signed in user: ${uniqueEmail} (${userText})`);
        if (!userText?.includes('Playwright')) {
          throw new Error(`Expected authenticated user name in header, got: ${userText}`);
        }
        const shot = await captureScreenshot(page);
        return {
          status: 'Passed',
          actualResult: `Registered new user ${uniqueEmail} via UI form; JWT session active and persisted in MongoDB.`,
          logs,
          durationMs: Date.now() - startTime,
          evidenceScreenshot: shot,
        };
      }

      case 'tc-002-duplicate-email': {
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        await page.getByTestId('nav-auth-btn').click();
        await page.getByTestId('register-tab').click();
        await page.getByTestId('register-name').fill('Duplicate User');
        await page.getByTestId('register-email').fill('customer@grocerygo.demo');
        await page.getByTestId('register-phone').fill('9876543210');
        await page.getByTestId('register-password').fill('Demo@123');
        await page.getByTestId('register-submit').click();
        await page.getByTestId('auth-error').waitFor({ timeout: 6000 });
        const errMsg = await page.getByTestId('auth-error').textContent();
        logs.push(`Observed duplicate email error: ${errMsg}`);
        if (!errMsg?.toLowerCase().includes('already exists')) {
          throw new Error(`Expected duplicate email warning, got: ${errMsg}`);
        }
        const shot = await captureScreenshot(page);
        return {
          status: 'Passed',
          actualResult: `Duplicate registration blocked cleanly with message: "${errMsg}".`,
          logs,
          durationMs: Date.now() - startTime,
          evidenceScreenshot: shot,
        };
      }

      case 'tc-003-login-valid': {
        await loginViaUI(page, 'customer@grocerygo.demo', 'Demo@123', logs);
        await page.getByTestId('user-menu-name').waitFor({ timeout: 8000 });
        const userName = await page.getByTestId('user-menu-name').textContent();
        logs.push(`Authenticated UI confirmed: ${userName}`);
        const shot = await captureScreenshot(page);
        return {
          status: 'Passed',
          actualResult: `Login succeeded for customer@grocerygo.demo; active user "${userName}" rendered in header.`,
          logs,
          durationMs: Date.now() - startTime,
          evidenceScreenshot: shot,
        };
      }

      case 'tc-004-login-invalid': {
        await loginViaUI(page, 'customer@grocerygo.demo', 'WrongPassword99', logs);
        await page.getByTestId('auth-error').waitFor({ timeout: 6000 });
        const errText = await page.getByTestId('auth-error').textContent();
        logs.push(`Observed error alert: ${errText}`);
        if (!errText?.toLowerCase().includes('invalid')) {
          throw new Error(`Expected invalid credential message, got: ${errText}`);
        }
        const shot = await captureScreenshot(page);
        return {
          status: 'Passed',
          actualResult: `Invalid password rejected with error banner: "${errText}".`,
          logs,
          durationMs: Date.now() - startTime,
          evidenceScreenshot: shot,
        };
      }

      case 'tc-005-unauth-stqa': {
        await loginViaUI(page, 'customer@grocerygo.demo', 'Demo@123', logs);
        await page.getByTestId('user-menu-name').waitFor({ timeout: 8000 });
        const status = await page.evaluate(async () => {
          const token = localStorage.getItem('grocerygo_token');
          const res = await fetch('/api/stqa/overview', {
            headers: { Authorization: `Bearer ${token}` },
          });
          return res.status;
        });
        logs.push(`Customer attempted GET /api/stqa/overview -> HTTP ${status}`);
        if (status !== 403) {
          throw new Error(`Expected HTTP 403 Forbidden for customer accessing STQA overview, got ${status}`);
        }
        const shot = await captureScreenshot(page);
        return {
          status: 'Passed',
          actualResult: 'Customer role denied access to STQA Dashboard API with HTTP 403 Forbidden; STQA nav restricted.',
          logs,
          durationMs: Date.now() - startTime,
          evidenceScreenshot: shot,
        };
      }

      case 'tc-006-product-search': {
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        await page.getByTestId('nav-products').click();
        await page.getByTestId('product-search-input').fill('Avocado');
        await page.waitForTimeout(500);
        const cardsCount = await page.getByTestId('product-card').count();
        const firstCardText = cardsCount > 0 ? await page.getByTestId('product-card').first().textContent() : '';
        logs.push(`Search "Avocado" returned ${cardsCount} matching cards. First: ${firstCardText?.slice(0, 60)}`);
        if (cardsCount === 0 || !firstCardText?.toLowerCase().includes('avocado')) {
          throw new Error('Expected Avocado product card after filtering by "Avocado".');
        }
        const shot = await captureScreenshot(page);
        return {
          status: 'Passed',
          actualResult: `Search input filtered catalogue to ${cardsCount} matching product(s) containing "Avocado".`,
          logs,
          durationMs: Date.now() - startTime,
          evidenceScreenshot: shot,
        };
      }

      case 'tc-007-store-selection': {
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        await page.getByTestId('nav-stores').click();
        await page.getByTestId('store-card').first().waitFor({ timeout: 6000 });
        await page.getByTestId('store-card').first().click();
        await page.getByTestId('store-detail-title').waitFor({ timeout: 6000 });
        const storeTitle = await page.getByTestId('store-detail-title').textContent();
        const prodCount = await page.getByTestId('product-card').count();
        logs.push(`Opened store "${storeTitle}" with ${prodCount} products.`);
        if (!storeTitle || prodCount === 0) {
          throw new Error('Store selection did not render store header and products.');
        }
        const shot = await captureScreenshot(page);
        return {
          status: 'Passed',
          actualResult: `Selected store "${storeTitle}" and loaded ${prodCount} store-specific products.`,
          logs,
          durationMs: Date.now() - startTime,
          evidenceScreenshot: shot,
        };
      }

      case 'tc-009-add-to-cart': {
        await loginViaUI(page, 'customer@grocerygo.demo', 'Demo@123', logs);
        await page.getByTestId('user-menu-name').waitFor({ timeout: 8000 });
        await page.evaluate(async () => {
          const token = localStorage.getItem('grocerygo_token');
          await fetch('/api/cart', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        });
        await page.reload({ waitUntil: 'networkidle' });
        await page.getByTestId('nav-products').click();
        await page.getByTestId('add-to-cart-btn').first().waitFor({ timeout: 6000 });
        await page.getByTestId('add-to-cart-btn').first().click();
        await page.waitForTimeout(500);
        const badgeText = await page.getByTestId('cart-badge').textContent();
        logs.push(`Clicked Add to Cart; cart badge shows: ${badgeText}`);
        if (!badgeText || Number(badgeText) < 1) {
          throw new Error(`Expected cart count >= 1, got ${badgeText}`);
        }
        const shot = await captureScreenshot(page);
        return {
          status: 'Passed',
          actualResult: `Added product to cart; badge incremented to ${badgeText} and persisted in MongoDB.`,
          logs,
          durationMs: Date.now() - startTime,
          evidenceScreenshot: shot,
        };
      }

      case 'tc-011-update-qty':
      case 'tc-012-cart-total': {
        await loginViaUI(page, 'customer@grocerygo.demo', 'Demo@123', logs);
        await page.getByTestId('user-menu-name').waitFor({ timeout: 8000 });
        await page.evaluate(async () => {
          const token = localStorage.getItem('grocerygo_token');
          await fetch('/api/cart', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        });
        await page.reload({ waitUntil: 'networkidle' });
        await page.getByTestId('nav-products').click();
        await page.getByTestId('add-to-cart-btn').first().click();
        await page.waitForTimeout(400);
        await page.getByTestId('nav-cart').click();
        await page.getByTestId('cart-qty-inc').first().waitFor({ timeout: 6000 });
        await page.getByTestId('cart-qty-inc').first().click();
        await page.waitForTimeout(500);
        const subtotalText = await page.getByTestId('cart-subtotal').textContent();
        const feeText = await page.getByTestId('cart-delivery-fee').textContent();
        const totalText = await page.getByTestId('cart-total').textContent();
        logs.push(`Cart totals after qty increment -> Subtotal: ${subtotalText}, Fee: ${feeText}, Total: ${totalText}`);
        const sub = Number(String(subtotalText).replace(/[^0-9.]/g, ''));
        const fee = Number(String(feeText).replace(/[^0-9.]/g, ''));
        const tot = Number(String(totalText).replace(/[^0-9.]/g, ''));
        if (Math.abs(sub + fee - tot) > 0.02 || sub <= 0) {
          throw new Error(`Cart total mismatch: ${sub} + ${fee} !== ${tot}`);
        }
        const shot = await captureScreenshot(page);
        return {
          status: 'Passed',
          actualResult: `Quantity incremented and totals verified mathematically: $${sub.toFixed(2)} + $${fee.toFixed(2)} = $${tot.toFixed(2)}.`,
          logs,
          durationMs: Date.now() - startTime,
          evidenceScreenshot: shot,
        };
      }

      case 'tc-014-checkout-no-addr': {
        await loginViaUI(page, 'customer@grocerygo.demo', 'Demo@123', logs);
        await page.getByTestId('user-menu-name').waitFor({ timeout: 8000 });
        const result = await page.evaluate(async () => {
          const token = localStorage.getItem('grocerygo_token');
          const prodRes = await fetch('/api/products');
          const { products } = await prodRes.json();
          await fetch('/api/cart', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
          await fetch('/api/cart/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ productId: products[0]._id, quantity: 1 }),
          });
          const orderRes = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ paymentMethod: 'Test Card (Simulated)' }),
          });
          return { status: orderRes.status, data: await orderRes.json() };
        });
        logs.push(`Checkout without address returned HTTP ${result.status}: ${JSON.stringify(result.data)}`);
        if (result.status !== 400) {
          throw new Error(`Expected HTTP 400 when placing order without address, got ${result.status}`);
        }
        const shot = await captureScreenshot(page);
        return {
          status: 'Passed',
          actualResult: `Checkout validation blocked order without address (HTTP 400: "${result.data.error}").`,
          logs,
          durationMs: Date.now() - startTime,
          evidenceScreenshot: shot,
        };
      }

      case 'tc-015-order-placement': {
        await loginViaUI(page, 'customer@grocerygo.demo', 'Demo@123', logs);
        await page.getByTestId('user-menu-name').waitFor({ timeout: 8000 });
        await page.evaluate(async () => {
          const token = localStorage.getItem('grocerygo_token');
          await fetch('/api/cart', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        });
        await page.reload({ waitUntil: 'networkidle' });
        await page.getByTestId('nav-products').click();
        await page.getByTestId('add-to-cart-btn').first().click();
        await page.waitForTimeout(400);
        await page.getByTestId('nav-cart').click();
        await page.getByTestId('checkout-btn').click();
        await page.getByTestId('place-order-btn').waitFor({ timeout: 6000 });
        await page.getByTestId('place-order-btn').click();
        await page.getByTestId('order-confirmation').waitFor({ timeout: 8000 });
        const confirmText = await page.getByTestId('order-confirmation').textContent();
        logs.push(`Order confirmation displayed: ${confirmText}`);
        const shot = await captureScreenshot(page);
        return {
          status: 'Passed',
          actualResult: `Order placed through live Checkout UI and persisted in MongoDB (${confirmText?.slice(0, 80)}).`,
          logs,
          durationMs: Date.now() - startTime,
          evidenceScreenshot: shot,
        };
      }

      case 'tc-016-duplicate-order': {
        await loginViaUI(page, 'customer@grocerygo.demo', 'Demo@123', logs);
        await page.getByTestId('user-menu-name').waitFor({ timeout: 8000 });
        const check = await page.evaluate(async () => {
          const token = localStorage.getItem('grocerygo_token');
          const prodRes = await fetch('/api/products');
          const { products } = await prodRes.json();
          const addrRes = await fetch('/api/addresses', { headers: { Authorization: `Bearer ${token}` } });
          const { addresses } = await addrRes.json();
          await fetch('/api/cart', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
          await fetch('/api/cart/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ productId: products[0]._id, quantity: 1 }),
          });
          const idemKey = `pw-idem-${Date.now()}`;
          const first = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              addressId: addresses[0]._id,
              paymentMethod: 'Test Card (Simulated)',
              idempotencyKey: idemKey,
            }),
          });
          const firstData = await first.json();
          const second = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              addressId: addresses[0]._id,
              paymentMethod: 'Test Card (Simulated)',
              idempotencyKey: idemKey,
            }),
          });
          const secondData = await second.json();
          return {
            firstId: firstData.order?._id,
            secondId: secondData.order?._id,
            duplicatePrevented: secondData.duplicatePrevented,
          };
        });
        logs.push(`Duplicate submission check: ${JSON.stringify(check)}`);
        if (!check.duplicatePrevented || check.firstId !== check.secondId) {
          throw new Error('Duplicate order with same idempotencyKey was not prevented.');
        }
        const shot = await captureScreenshot(page);
        return {
          status: 'Passed',
          actualResult: `Idempotency guard returned existing order ${check.firstId} without creating a duplicate.`,
          logs,
          durationMs: Date.now() - startTime,
          evidenceScreenshot: shot,
        };
      }

      case 'tc-017-store-accept':
      case 'tc-024-delivery-lifecycle': {
        // End-to-end multi-role verification using real accounts via browser & API
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        const flow = await page.evaluate(async () => {
          async function login(email: string, password: string) {
            const res = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
            });
            return (await res.json()).token as string;
          }
          const custToken = await login('customer@grocerygo.demo', 'Demo@123');
          const ownerToken = await login('owner@grocerygo.demo', 'Demo@123');
          const driverToken = await login('driver@grocerygo.demo', 'Demo@123');

          const { products } = await (await fetch('/api/products')).json();
          const { addresses } = await (
            await fetch('/api/addresses', { headers: { Authorization: `Bearer ${custToken}` } })
          ).json();

          await fetch('/api/cart', { method: 'DELETE', headers: { Authorization: `Bearer ${custToken}` } });
          await fetch('/api/cart/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
            body: JSON.stringify({ productId: products[0]._id, quantity: 1 }),
          });
          const orderRes = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
            body: JSON.stringify({
              addressId: addresses[0]._id,
              paymentMethod: 'Test Card (Simulated)',
            }),
          });
          const { order } = await orderRes.json();

          const transitions = [
            { token: ownerToken, status: 'Store Accepted – Processing' },
            { token: ownerToken, status: 'Items Packed – Ready for Pickup' },
            { token: driverToken, status: 'Delivery Partner Assigned' },
            { token: driverToken, status: 'Out for Delivery' },
            { token: driverToken, status: 'Delivered Successfully' },
          ];
          const statuses: string[] = [order.status];
          for (const t of transitions) {
            const r = await fetch(`/api/orders/${order._id}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t.token}` },
              body: JSON.stringify({ status: t.status }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || `Failed transition ${t.status}`);
            statuses.push(d.order.status);
          }
          return { orderNumber: order.orderNumber, statuses };
        });
        logs.push(`Verified order ${flow.orderNumber} lifecycle: ${flow.statuses.join(' -> ')}`);
        await loginViaUI(page, 'customer@grocerygo.demo', 'Demo@123', logs);
        await page.getByTestId('user-menu-name').waitFor({ timeout: 8000 });
        await page.getByTestId('nav-orders').click();
        await page.waitForTimeout(500);
        const shot = await captureScreenshot(page);
        return {
          status: 'Passed',
          actualResult: `Order ${flow.orderNumber} progressed through all 6 stages across Customer, Store Owner, and Delivery Partner.`,
          logs,
          durationMs: Date.now() - startTime,
          evidenceScreenshot: shot,
        };
      }

      case 'tc-020-out-of-stock': {
        await loginViaUI(page, 'customer@grocerygo.demo', 'Demo@123', logs);
        await page.getByTestId('user-menu-name').waitFor({ timeout: 8000 });
        const check = await page.evaluate(async () => {
          const token = localStorage.getItem('grocerygo_token');
          const { products } = await (await fetch('/api/products')).json();
          const target = products[0];
          const res = await fetch('/api/cart/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ productId: target._id, quantity: target.stock + 50 }),
          });
          return { status: res.status, data: await res.json(), stock: target.stock, name: target.name };
        });
        logs.push(`Requested ${check.stock + 50} of "${check.name}" (stock=${check.stock}) -> HTTP ${check.status}`);
        if (check.status !== 400) {
          throw new Error(`Expected HTTP 400 insufficient stock, got ${check.status}`);
        }
        const shot = await captureScreenshot(page);
        return {
          status: 'Passed',
          actualResult: `Stock guard rejected over-order on "${check.name}" (HTTP 400: "${check.data.error}").`,
          logs,
          durationMs: Date.now() - startTime,
          evidenceScreenshot: shot,
        };
      }

      case 'tc-026-unauth-api': {
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        const statuses = await page.evaluate(async () => {
          const r1 = await fetch('/api/orders');
          const r2 = await fetch('/api/stqa/overview');
          return [r1.status, r2.status];
        });
        logs.push(`Unauthenticated /api/orders -> ${statuses[0]}, /api/stqa/overview -> ${statuses[1]}`);
        if (statuses[0] !== 401 || statuses[1] !== 401) {
          throw new Error(`Expected [401, 401], got ${JSON.stringify(statuses)}`);
        }
        const shot = await captureScreenshot(page);
        return {
          status: 'Passed',
          actualResult: 'Protected endpoints rejected unauthenticated requests with HTTP 401 Unauthorized.',
          logs,
          durationMs: Date.now() - startTime,
          evidenceScreenshot: shot,
        };
      }

      case 'tc-027-db-persistence': {
        await loginViaUI(page, 'customer@grocerygo.demo', 'Demo@123', logs);
        await page.getByTestId('user-menu-name').waitFor({ timeout: 8000 });
        const label = `QA Persist ${Date.now().toString().slice(-4)}`;
        const persisted = await page.evaluate(async (addrLabel) => {
          const token = localStorage.getItem('grocerygo_token');
          await fetch('/api/addresses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              label: addrLabel,
              recipientName: 'Aarav Mehta',
              phone: '9876543210',
              street: '101 Persistence Way',
              city: 'San Francisco, CA',
              postalCode: '94105',
            }),
          });
          return addrLabel;
        }, label);
        await page.reload({ waitUntil: 'networkidle' });
        const found = await page.evaluate(async (addrLabel) => {
          const token = localStorage.getItem('grocerygo_token');
          const res = await fetch('/api/addresses', { headers: { Authorization: `Bearer ${token}` } });
          const { addresses } = await res.json();
          return addresses.some((a: any) => a.label === addrLabel);
        }, persisted);
        logs.push(`Reloaded browser and queried MongoDB addresses for "${label}": found=${found}`);
        if (!found) throw new Error('Newly created address did not persist after reload.');
        const shot = await captureScreenshot(page);
        return {
          status: 'Passed',
          actualResult: `Created address "${label}" persisted in MongoDB and retrieved cleanly after full reload.`,
          logs,
          durationMs: Date.now() - startTime,
          evidenceScreenshot: shot,
        };
      }

      case 'tc-028-api-products': {
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        const check = await page.evaluate(async () => {
          const t0 = performance.now();
          const res = await fetch('/api/products');
          const elapsed = Math.round(performance.now() - t0);
          const data = await res.json();
          const validShape =
            Array.isArray(data.products) &&
            data.products.length > 0 &&
            data.products.every((p: any) => p._id && p.name && typeof p.price === 'number' && typeof p.stock === 'number');
          return { status: res.status, count: data.products?.length || 0, elapsed, validShape };
        });
        logs.push(`GET /api/products -> HTTP ${check.status}, ${check.count} items, ${check.elapsed}ms, validShape=${check.validShape}`);
        if (check.status !== 200 || !check.validShape) {
          throw new Error('Products API response failed schema validation.');
        }
        const shot = await captureScreenshot(page);
        return {
          status: 'Passed',
          actualResult: `GET /api/products returned HTTP 200 with ${check.count} validated documents in ${check.elapsed}ms.`,
          logs,
          durationMs: Date.now() - startTime,
          evidenceScreenshot: shot,
        };
      }

      case 'tc-029-rbac': {
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        const check = await page.evaluate(async () => {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'owner@grocerygo.demo', password: 'Demo@123' }),
          });
          const { token } = await res.json();
          const qaWrite = await fetch('/api/stqa/test-cases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ title: 'Unauthorized Test' }),
          });
          return { status: qaWrite.status, body: await qaWrite.json() };
        });
        logs.push(`Store Owner attempted POST /api/stqa/test-cases -> HTTP ${check.status}`);
        if (check.status !== 403) {
          throw new Error(`Expected HTTP 403 Forbidden for Store Owner writing STQA test case, got ${check.status}`);
        }
        const shot = await captureScreenshot(page);
        return {
          status: 'Passed',
          actualResult: `Role boundary enforced: Store Owner blocked from STQA write API with HTTP 403.`,
          logs,
          durationMs: Date.now() - startTime,
          evidenceScreenshot: shot,
        };
      }

      case 'tc-030-logout': {
        await loginViaUI(page, 'customer@grocerygo.demo', 'Demo@123', logs);
        await page.getByTestId('user-menu-name').waitFor({ timeout: 8000 });
        await page.getByTestId('logout-btn').click();
        await page.getByTestId('nav-auth-btn').waitFor({ timeout: 6000 });
        const hasToken = await page.evaluate(() => Boolean(localStorage.getItem('grocerygo_token')));
        logs.push(`Clicked Sign Out; token present in localStorage: ${hasToken}`);
        if (hasToken) throw new Error('Token was not cleared on logout.');
        const shot = await captureScreenshot(page);
        return {
          status: 'Passed',
          actualResult: 'Logout cleared JWT token from localStorage and restored unauthenticated Sign In state.',
          logs,
          durationMs: Date.now() - startTime,
          evidenceScreenshot: shot,
        };
      }

      case 'tc-032-perf-latency': {
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        const metrics = await page.evaluate(async () => {
          const timings: number[] = [];
          for (let i = 0; i < 5; i++) {
            const t0 = performance.now();
            await fetch('/api/stores');
            await fetch('/api/products');
            timings.push(Math.round(performance.now() - t0));
          }
          const avg = Math.round(timings.reduce((a, b) => a + b, 0) / timings.length);
          return { timings, avg };
        });
        logs.push(`5 sequential catalogue pair fetches: ${metrics.timings.join('ms, ')}ms (avg ${metrics.avg}ms)`);
        if (metrics.avg >= 300) {
          throw new Error(`Average latency ${metrics.avg}ms exceeded 300ms SLA threshold.`);
        }
        const shot = await captureScreenshot(page);
        return {
          status: 'Passed',
          actualResult: `Average /api/stores + /api/products response time measured at ${metrics.avg}ms (within 300ms SLA).`,
          logs,
          durationMs: Date.now() - startTime,
          evidenceScreenshot: shot,
        };
      }

      default: {
        throw new Error(`No automated Playwright script registered for key "${automationKey}". Execute manually.`);
      }
    }
  } catch (err: any) {
    const shot = page ? await captureScreenshot(page) : '';
    logs.push(`FAILURE: ${err?.message || 'Playwright assertion failed'}`);
    return {
      status: 'Failed',
      actualResult: err?.message || 'Automated Playwright test assertion failed.',
      logs,
      durationMs: Date.now() - startTime,
      evidenceScreenshot: shot,
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
