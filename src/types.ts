export type UserRole = 'customer' | 'store_owner' | 'delivery_partner' | 'qa_admin';

export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  isSeeded?: boolean;
}

export interface Store {
  _id: string;
  name: string;
  slug: string;
  description: string;
  categoryFocus: string;
  imageUrl: string;
  address: string;
  rating: number;
  deliveryTimeMinutes: number;
  deliveryFee: number;
  minOrderAmount: number;
  isOpen: boolean;
  ownerId: string;
  isSeeded?: boolean;
}

export interface Product {
  _id: string;
  storeId: string | { _id: string; name: string; slug?: string; deliveryTimeMinutes?: number; deliveryFee?: number; isOpen?: boolean; address?: string; rating?: number };
  name: string;
  description: string;
  category: 'Fresh Produce' | 'Dairy & Bakery' | 'Pantry Staples' | 'Beverages' | 'Snacks & Frozen';
  price: number;
  unit: string;
  stock: number;
  imageUrl: string;
  isAvailable: boolean;
  isPopular: boolean;
  isSeeded?: boolean;
}

export interface CartItem {
  productId: string;
  storeId: string;
  storeName: string;
  name: string;
  unit: string;
  price: number;
  stock: number;
  isAvailable: boolean;
  imageUrl: string;
  quantity: number;
  lineTotal: number;
}

export interface CartData {
  items: CartItem[];
  store: {
    _id: string;
    name: string;
    deliveryFee: number;
    deliveryTimeMinutes: number;
    minOrderAmount: number;
  } | null;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  itemCount: number;
}

export interface Address {
  _id: string;
  label: string;
  recipientName: string;
  phone: string;
  street: string;
  city: string;
  postalCode: string;
  isDefault: boolean;
}

export interface Order {
  _id: string;
  orderNumber: string;
  customerId: { _id: string; name: string; email: string; phone: string } | string;
  storeId: { _id: string; name: string; address: string; deliveryTimeMinutes: number } | string;
  deliveryPartnerId?: { _id: string; name: string; phone: string } | string | null;
  items: {
    productId: string;
    name: string;
    unit: string;
    price: number;
    quantity: number;
    subtotal: number;
  }[];
  deliveryAddress: {
    label: string;
    recipientName: string;
    phone: string;
    street: string;
    city: string;
    postalCode: string;
  };
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  status: string;
  statusHistory: {
    status: string;
    updatedByName?: string;
    role?: string;
    note?: string;
    timestamp: string;
  }[];
  createdAt: string;
}

export interface TestSuite {
  _id: string;
  name: string;
  slug: string;
  description: string;
  moduleCategory: string;
  isCustom: boolean;
  totalCases?: number;
  passedCases?: number;
  failedCases?: number;
}

export interface TestCase {
  _id: string;
  testCaseId: string;
  title: string;
  suiteId: { _id: string; name: string; slug: string } | string;
  module: string;
  testScenario: string;
  preconditions: string;
  testSteps: string[];
  testData: string;
  expectedResult: string;
  actualResult: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Not Executed' | 'Passed' | 'Failed' | 'Blocked';
  automationKey?: string | null;
  updatedAt: string;
}

export interface TestExecution {
  _id: string;
  testCaseId: { _id: string; testCaseId: string; title: string; module: string } | string;
  tcCode: string;
  executionMode: 'Manual' | 'Automated (Playwright)';
  status: 'Passed' | 'Failed' | 'Blocked';
  actualResult: string;
  comments: string;
  evidenceScreenshot: string;
  durationMs: number;
  logs: string[];
  executorName: string;
  createdAt: string;
}

export interface Defect {
  _id: string;
  defectId: string;
  title: string;
  module: string;
  description: string;
  stepsToReproduce: string;
  expectedResult: string;
  actualResult: string;
  severity: 'Critical' | 'Major' | 'Minor' | 'Trivial';
  priority: 'High' | 'Medium' | 'Low';
  status: 'Open' | 'Assigned' | 'In Progress' | 'Fixed' | 'Retest' | 'Closed' | 'Reopened';
  assignedTo: string;
  linkedTestCaseId?: { _id: string; testCaseId: string; title: string; status: string } | null;
  evidenceScreenshot?: string;
  reportedByName: string;
  reportedDate: string;
  comments: { authorName: string; role: string; text: string; createdAt: string }[];
  statusHistory: { status: string; changedBy: string; note: string; timestamp: string }[];
}

export interface RtmRow {
  _id: string;
  reqId: string;
  title: string;
  description: string;
  module: string;
  priority: 'High' | 'Medium' | 'Low';
  linkedTestCaseIds: { _id: string; testCaseId: string; title: string; status: string; module: string; priority: string }[];
  linkedDefects: { _id: string; defectId: string; status: string; severity: string }[];
  coverageStatus: string;
}
