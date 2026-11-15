import { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bug,
  ClipboardList,
  FileBarChart2,
  FolderKanban,
  Gauge,
  GitBranch,
  Home,
  LogIn,
  LogOut,
  Menu,
  Package,
  PlayCircle,
  Settings,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  Store as StoreIcon,
  Terminal,
  Truck,
  User as UserIcon,
  X,
} from 'lucide-react';
import { apiRequest, getAuthToken, getSocket, setAuthToken } from './api.ts';
import { AuthModal } from './components/AuthModal.tsx';
import { CartCheckoutView } from './components/grocery/CartCheckoutView.tsx';
import { GroceryHome } from './components/grocery/GroceryHome.tsx';
import {
  DeliveryPartnerPortal,
  ProfileView,
  StoreOwnerPortal,
} from './components/grocery/OperationsPortals.tsx';
import { OrdersTrackingView } from './components/grocery/OrdersTrackingView.tsx';
import { ProductsView } from './components/grocery/ProductsView.tsx';
import { StoresView } from './components/grocery/StoresView.tsx';
import { ApiTestingView } from './components/stqa/ApiTestingView.tsx';
import { ActivityLogsView, StqaSettingsView } from './components/stqa/AuditSettingsView.tsx';
import { DefectsView } from './components/stqa/DefectsView.tsx';
import { NonFunctionalView } from './components/stqa/NonFunctionalView.tsx';
import { QaReportsView } from './components/stqa/QaReportsView.tsx';
import { RtmView } from './components/stqa/RtmView.tsx';
import { StqaOverview } from './components/stqa/StqaOverview.tsx';
import { TestCasesView } from './components/stqa/TestCasesView.tsx';
import { TestExecutionView } from './components/stqa/TestExecutionView.tsx';
import { TestSuitesView } from './components/stqa/TestSuitesView.tsx';
import type {
  Address,
  CartData,
  Order,
  Product,
  Store,
  TestCase,
  TestExecution,
  User,
} from './types.ts';

type PageKey =
  | 'home'
  | 'stores'
  | 'products'
  | 'cart'
  | 'orders'
  | 'track'
  | 'profile'
  | 'store-portal'
  | 'delivery-portal'
  | 'stqa-overview'
  | 'stqa-cases'
  | 'stqa-suites'
  | 'stqa-execution'
  | 'stqa-defects'
  | 'stqa-rtm'
  | 'stqa-api'
  | 'stqa-nonfunctional'
  | 'stqa-reports'
  | 'stqa-logs'
  | 'stqa-settings';

const EMPTY_CART: CartData = {
  items: [],
  store: null,
  subtotal: 0,
  deliveryFee: 0,
  totalAmount: 0,
  itemCount: 0,
};

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartData>(EMPTY_CART);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [productSearchPreset, setProductSearchPreset] = useState({ query: '', category: 'All' });

  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState('');
  const [bannerInfo, setBannerInfo] = useState('');

  // STQA cross-tab state
  const [stqaRefreshSignal, setStqaRefreshSignal] = useState(0);
  const [preselectedTestCase, setPreselectedTestCase] = useState<TestCase | null>(null);
  const [defectPrefill, setDefectPrefill] = useState<{
    tc: TestCase;
    execution: TestExecution;
  } | null>(null);

  const loadCatalog = async () => {
    const [storeRes, prodRes] = await Promise.all([
      apiRequest<{ stores: Store[] }>('/api/stores'),
      apiRequest<{ products: Product[] }>('/api/products'),
    ]);
    setStores(storeRes.stores);
    setProducts(prodRes.products);
  };

  const loadUserContext = async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setCart(EMPTY_CART);
      setAddresses([]);
      setOrders([]);
      return;
    }
    try {
      const meRes = await apiRequest<{ user: User }>('/api/auth/me');
      setUser(meRes.user);
      const [cartRes, addrRes, ordRes] = await Promise.all([
        apiRequest<{ cart: CartData }>('/api/cart'),
        apiRequest<{ addresses: Address[] }>('/api/addresses'),
        apiRequest<{ orders: Order[] }>('/api/orders'),
      ]);
      setCart(cartRes.cart);
      setAddresses(addrRes.addresses);
      setOrders(ordRes.orders);
    } catch {
      setAuthToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    loadCatalog();
    loadUserContext();

    const socket = getSocket();
    socket.on('order:created', () => {
      loadUserContext();
      loadCatalog();
      setStqaRefreshSignal((n) => n + 1);
    });
    socket.on('order:updated', () => {
      loadUserContext();
      loadCatalog();
      setStqaRefreshSignal((n) => n + 1);
    });
    socket.on('inventory:updated', () => {
      loadCatalog();
    });
    socket.on('store:updated', () => {
      loadCatalog();
    });
    socket.on('stqa:updated', () => {
      setStqaRefreshSignal((n) => n + 1);
    });

    return () => {
      socket.off('order:created');
      socket.off('order:updated');
      socket.off('inventory:updated');
      socket.off('store:updated');
      socket.off('stqa:updated');
    };
  }, []);

  const handleAddToCart = async (product: Product, qty = 1) => {
    setBannerError('');
    setBannerInfo('');
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    setAddingProductId(product._id);
    try {
      const res = await apiRequest<{ cart: CartData }>('/api/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId: product._id, quantity: qty }),
      });
      setCart(res.cart);
      setBannerInfo(`Added ${product.name} to cart.`);
    } catch (err: any) {
      if (err.code === 'DIFFERENT_STORE') {
        const res = await apiRequest<{ cart: CartData }>('/api/cart/items', {
          method: 'POST',
          body: JSON.stringify({ productId: product._id, quantity: qty, replaceStore: true }),
        });
        setCart(res.cart);
        setBannerInfo(`Switched cart to ${product.name}'s store.`);
      } else {
        setBannerError(err.message || 'Could not add product to cart.');
      }
    } finally {
      setAddingProductId(null);
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuthToken(null);
    setUser(null);
    setCart(EMPTY_CART);
    setAddresses([]);
    setOrders([]);
    if (activePage.startsWith('stqa-') || activePage.endsWith('-portal')) {
      setActivePage('home');
    }
  };

  const navigate = (page: PageKey) => {
    setBannerError('');
    setBannerInfo('');
    setActivePage(page);
    setSidebarOpen(false);
  };

  const isStqaPage = activePage.startsWith('stqa-');
  const isQaAdmin = user?.role === 'qa_admin';

  const groceryNav: { key: PageKey; label: string; icon: any; testId?: string }[] = [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'stores', label: 'Stores', icon: StoreIcon, testId: 'nav-stores' },
    { key: 'products', label: 'Products', icon: ShoppingBag, testId: 'nav-products' },
    { key: 'cart', label: 'Cart', icon: ShoppingCart, testId: 'nav-cart' },
    { key: 'orders', label: 'My Orders', icon: Package, testId: 'nav-orders' },
    { key: 'track', label: 'Track Order', icon: Truck },
    { key: 'profile', label: 'Profile', icon: UserIcon },
  ];

  const stqaNav: { key: PageKey; label: string; icon: any }[] = [
    { key: 'stqa-overview', label: 'Overview', icon: BarChart3 },
    { key: 'stqa-cases', label: 'Test Cases', icon: ClipboardList },
    { key: 'stqa-suites', label: 'Test Suites', icon: FolderKanban },
    { key: 'stqa-execution', label: 'Test Execution', icon: PlayCircle },
    { key: 'stqa-defects', label: 'Defect Management', icon: Bug },
    { key: 'stqa-rtm', label: 'Requirements Traceability', icon: GitBranch },
    { key: 'stqa-api', label: 'API Testing', icon: Terminal },
    { key: 'stqa-nonfunctional', label: 'Non-Functional Testing', icon: Gauge },
    { key: 'stqa-reports', label: 'QA Reports', icon: FileBarChart2 },
    { key: 'stqa-logs', label: 'Activity Logs', icon: Activity },
    { key: 'stqa-settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
        />
      )}

      {/* Responsive Dark Navy Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-200 flex flex-col shrink-0 transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800">
          <button
            type="button"
            onClick={() => navigate('home')}
            className="font-display font-extrabold text-lg tracking-tight text-white whitespace-nowrap"
          >
            GroceryGo <span className="text-emerald-400">STQA</span>
          </button>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* GROCERYGO Section */}
          <div>
            <div className="px-3 mb-2 text-[11px] font-bold tracking-wider text-slate-400">
              GROCERYGO
            </div>
            <div className="space-y-0.5">
              {groceryNav.map((item) => {
                const Icon = item.icon;
                const active = activePage === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    data-testid={item.testId}
                    onClick={() => {
                      if (item.key === 'stores') setSelectedStore(null);
                      if (item.key === 'products') setSelectedProduct(null);
                      navigate(item.key);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.key === 'cart' && cart.itemCount > 0 && (
                      <span
                        data-testid="cart-badge"
                        className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 tabular-nums"
                      >
                        {cart.itemCount}
                      </span>
                    )}
                  </button>
                );
              })}

              {(user?.role === 'store_owner' || isQaAdmin) && (
                <button
                  type="button"
                  onClick={() => navigate('store-portal')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activePage === 'store-portal'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <StoreIcon className="w-4 h-4 shrink-0" />
                  <span>Store Portal</span>
                </button>
              )}

              {(user?.role === 'delivery_partner' || isQaAdmin) && (
                <button
                  type="button"
                  onClick={() => navigate('delivery-portal')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activePage === 'delivery-portal'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Truck className="w-4 h-4 shrink-0" />
                  <span>Delivery Portal</span>
                </button>
              )}
            </div>
          </div>

          {/* STQA TESTING Section */}
          <div>
            <div className="px-3 mb-2 text-[11px] font-bold tracking-wider text-slate-400">
              STQA TESTING
            </div>
            <div className="space-y-0.5">
              {stqaNav.map((item) => {
                const Icon = item.icon;
                const active = activePage === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => navigate(item.key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Clean 3-Zone Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-6 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-display font-bold text-slate-900 truncate whitespace-nowrap">
              {isStqaPage ? 'STQA Quality Workbench' : 'GroceryGo Storefront'}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => navigate('home')}
              className="hover:text-slate-900 whitespace-nowrap shrink-0"
            >
              Shop Groceries
            </button>
            <button
              type="button"
              onClick={() => navigate('stores')}
              className="hover:text-slate-900 whitespace-nowrap shrink-0"
            >
              Stores
            </button>
            <button
              type="button"
              onClick={() => navigate('orders')}
              className="hover:text-slate-900 whitespace-nowrap shrink-0"
            >
              Track Orders
            </button>
            <button
              type="button"
              onClick={() => navigate('stqa-overview')}
              className="hover:text-slate-900 whitespace-nowrap shrink-0"
            >
              STQA Dashboard
            </button>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div
                    data-testid="user-menu-name"
                    className="text-xs font-bold text-slate-900 whitespace-nowrap"
                  >
                    {user.name}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                    {user.role}
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="logout-btn"
                  onClick={handleLogout}
                  className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-testid="nav-auth-btn"
                onClick={() => setAuthModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {bannerError && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between">
              <span>{bannerError}</span>
              <button type="button" onClick={() => setBannerError('')} className="text-xs underline">
                Dismiss
              </button>
            </div>
          )}
          {bannerInfo && (
            <div className="mb-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center justify-between">
              <span>{bannerInfo}</span>
              <button type="button" onClick={() => setBannerInfo('')} className="text-xs underline">
                Dismiss
              </button>
            </div>
          )}

          {/* Module A Views */}
          {activePage === 'home' && (
            <GroceryHome
              stores={stores}
              products={products}
              onSearchProducts={(query, category = 'All') => {
                setProductSearchPreset({ query, category });
                setSelectedProduct(null);
                navigate('products');
              }}
              onSelectStore={(store) => {
                setSelectedStore(store);
                navigate('stores');
              }}
              onSelectProduct={(product) => {
                setSelectedProduct(product);
                navigate('products');
              }}
              onAddToCart={handleAddToCart}
              addingProductId={addingProductId}
            />
          )}

          {activePage === 'stores' && (
            <StoresView
              stores={stores}
              products={products}
              selectedStore={selectedStore}
              onSelectStore={setSelectedStore}
              onSelectProduct={(product) => {
                setSelectedProduct(product);
                navigate('products');
              }}
              onAddToCart={handleAddToCart}
              addingProductId={addingProductId}
            />
          )}

          {activePage === 'products' && (
            <ProductsView
              products={products}
              stores={stores}
              selectedProduct={selectedProduct}
              onSelectProduct={setSelectedProduct}
              initialSearch={productSearchPreset.query}
              initialCategory={productSearchPreset.category}
              onAddToCart={handleAddToCart}
              addingProductId={addingProductId}
            />
          )}

          {activePage === 'cart' && (
            <CartCheckoutView
              user={user}
              cart={cart}
              addresses={addresses}
              onOpenAuth={() => setAuthModalOpen(true)}
              onRefreshCart={loadUserContext}
              onRefreshAddresses={loadUserContext}
              onOrderPlaced={(ord) => {
                setSelectedOrderId(ord._id);
                loadUserContext();
                loadCatalog();
                setStqaRefreshSignal((n) => n + 1);
              }}
              onBrowseProducts={() => navigate('products')}
            />
          )}

          {(activePage === 'orders' || activePage === 'track') && (
            <OrdersTrackingView
              user={user}
              orders={orders}
              selectedOrderId={selectedOrderId}
              onSelectOrderId={setSelectedOrderId}
              onRefreshOrders={loadUserContext}
              onOpenAuth={() => setAuthModalOpen(true)}
            />
          )}

          {activePage === 'profile' && (
            <ProfileView
              user={user}
              addresses={addresses}
              onRefreshAddresses={loadUserContext}
              onUserUpdated={setUser}
              onOpenAuth={() => setAuthModalOpen(true)}
            />
          )}

          {activePage === 'store-portal' && user && (
            <StoreOwnerPortal
              user={user}
              stores={stores}
              products={products}
              orders={orders}
              onRefreshAll={async () => {
                await loadCatalog();
                await loadUserContext();
              }}
            />
          )}

          {activePage === 'delivery-portal' && user && (
            <DeliveryPartnerPortal orders={orders} onRefreshOrders={loadUserContext} />
          )}

          {/* Module B: STQA Testing Dashboard (Role-Guarded for qa_admin) */}
          {isStqaPage && !isQaAdmin && (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-lg mx-auto">
              <ShieldAlert className="w-10 h-10 text-amber-600 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-slate-900">
                QA Tester / Admin Authorization Required
              </h2>
              <p className="text-sm text-slate-600 mt-1.5">
                {user
                  ? `Your current account role ("${user.role}") does not have permission to access the STQA Testing Dashboard.`
                  : 'Please sign in with a QA Tester / Admin account (qa@grocerygo.demo) to access STQA tools.'}
              </p>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="mt-5 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
              >
                Sign In as QA Admin
              </button>
            </div>
          )}

          {isStqaPage && isQaAdmin && (
            <>
              {activePage === 'stqa-overview' && (
                <StqaOverview refreshSignal={stqaRefreshSignal} />
              )}
              {activePage === 'stqa-cases' && (
                <TestCasesView
                  onExecuteTestCase={(tc) => {
                    setPreselectedTestCase(tc);
                    navigate('stqa-execution');
                  }}
                  onDataChanged={() => setStqaRefreshSignal((n) => n + 1)}
                />
              )}
              {activePage === 'stqa-suites' && (
                <TestSuitesView
                  onExecuteTestCase={(tc) => {
                    setPreselectedTestCase(tc);
                    navigate('stqa-execution');
                  }}
                  onDataChanged={() => setStqaRefreshSignal((n) => n + 1)}
                />
              )}
              {activePage === 'stqa-execution' && (
                <TestExecutionView
                  preselectedCase={preselectedTestCase}
                  onReportDefectFromExecution={(tc, execution) => {
                    setDefectPrefill({ tc, execution });
                    navigate('stqa-defects');
                  }}
                  onDataChanged={() => setStqaRefreshSignal((n) => n + 1)}
                />
              )}
              {activePage === 'stqa-defects' && (
                <DefectsView
                  prefillFromExecution={defectPrefill}
                  onClearPrefill={() => setDefectPrefill(null)}
                  onDataChanged={() => setStqaRefreshSignal((n) => n + 1)}
                />
              )}
              {activePage === 'stqa-rtm' && <RtmView />}
              {activePage === 'stqa-api' && <ApiTestingView />}
              {activePage === 'stqa-nonfunctional' && <NonFunctionalView />}
              {activePage === 'stqa-reports' && <QaReportsView />}
              {activePage === 'stqa-logs' && <ActivityLogsView />}
              {activePage === 'stqa-settings' && (
                <StqaSettingsView
                  onDataReset={async () => {
                    await loadCatalog();
                    await loadUserContext();
                    setStqaRefreshSignal((n) => n + 1);
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={async (loggedInUser) => {
          setUser(loggedInUser);
          await loadUserContext();
          if (loggedInUser.role === 'qa_admin') {
            navigate('stqa-overview');
          } else if (loggedInUser.role === 'store_owner') {
            navigate('store-portal');
          } else if (loggedInUser.role === 'delivery_partner') {
            navigate('delivery-portal');
          }
        }}
      />
    </div>
  );
}
