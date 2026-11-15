import mongoose, { Schema, Types } from 'mongoose';

export type UserRole = 'customer' | 'store_owner' | 'delivery_partner' | 'qa_admin';

export const ORDER_STATUSES = [
  'Order Placed – Awaiting Store Confirmation',
  'Store Accepted – Processing',
  'Items Packed – Ready for Pickup',
  'Delivery Partner Assigned',
  'Out for Delivery',
  'Delivered Successfully',
  'Rejected',
  'Cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const TEST_PRIORITIES = ['High', 'Medium', 'Low'] as const;
export const TEST_STATUSES = ['Not Executed', 'Passed', 'Failed', 'Blocked'] as const;
export const DEFECT_SEVERITIES = ['Critical', 'Major', 'Minor', 'Trivial'] as const;
export const DEFECT_STATUSES = [
  'Open',
  'Assigned',
  'In Progress',
  'Fixed',
  'Retest',
  'Closed',
  'Reopened',
] as const;

// 1. Users
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['customer', 'store_owner', 'delivery_partner', 'qa_admin'],
      default: 'customer',
      index: true,
    },
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null },
    isSeeded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 2. Stores
const storeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, required: true },
    categoryFocus: { type: String, default: 'Full-Service Grocery' },
    imageUrl: { type: String, required: true },
    address: { type: String, required: true },
    rating: { type: Number, default: 4.8, min: 1, max: 5 },
    deliveryTimeMinutes: { type: Number, default: 25 },
    deliveryFee: { type: Number, default: 2.99, min: 0 },
    minOrderAmount: { type: Number, default: 10, min: 0 },
    isOpen: { type: Boolean, default: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isSeeded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 3. Products
const productSchema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ['Fresh Produce', 'Dairy & Bakery', 'Pantry Staples', 'Beverages', 'Snacks & Frozen'],
      required: true,
      index: true,
    },
    price: { type: Number, required: true, min: 0.01 },
    unit: { type: String, required: true, default: '1 unit' },
    stock: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, required: true },
    isAvailable: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false },
    isSeeded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 4. Carts
const cartItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const cartSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    items: [cartItemSchema],
  },
  { timestamps: true }
);

// 5. Addresses
const addressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, required: true, trim: true },
    recipientName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 6. Orders
const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    unit: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true },
  },
  { _id: false }
);

const orderStatusHistorySchema = new Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedByName: { type: String },
    role: { type: String },
    note: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    deliveryPartnerId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    items: { type: [orderItemSchema], required: true },
    deliveryAddress: {
      label: { type: String, required: true },
      recipientName: { type: String, required: true },
      phone: { type: String, required: true },
      street: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
    },
    paymentMethod: {
      type: String,
      enum: ['Test Card (Simulated)', 'Test UPI (Simulated)', 'Cash on Delivery (Test)'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['Simulated Paid', 'COD Pending', 'Refunded (Simulated)'],
      required: true,
    },
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'Order Placed – Awaiting Store Confirmation',
      index: true,
    },
    statusHistory: [orderStatusHistorySchema],
    idempotencyKey: { type: String, default: null, index: true },
    isSeeded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 7. Test Suites
const testSuiteSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    moduleCategory: { type: String, required: true },
    isCustom: { type: Boolean, default: false },
    isSeeded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 8. Test Cases
const testCaseSchema = new Schema(
  {
    testCaseId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    suiteId: { type: Schema.Types.ObjectId, ref: 'TestSuite', required: true, index: true },
    module: { type: String, required: true, index: true },
    testScenario: { type: String, required: true },
    preconditions: { type: String, required: true },
    testSteps: { type: [String], required: true },
    testData: { type: String, default: '' },
    expectedResult: { type: String, required: true },
    actualResult: { type: String, default: '' },
    priority: { type: String, enum: TEST_PRIORITIES, default: 'Medium', index: true },
    status: { type: String, enum: TEST_STATUSES, default: 'Not Executed', index: true },
    automationKey: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isSeeded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 9. Test Executions
const testExecutionSchema = new Schema(
  {
    testCaseId: { type: Schema.Types.ObjectId, ref: 'TestCase', required: true, index: true },
    tcCode: { type: String, required: true, index: true },
    executionMode: {
      type: String,
      enum: ['Manual', 'Automated (Playwright)'],
      default: 'Manual',
    },
    status: { type: String, enum: ['Passed', 'Failed', 'Blocked'], required: true, index: true },
    actualResult: { type: String, required: true },
    comments: { type: String, default: '' },
    evidenceScreenshot: { type: String, default: '' },
    durationMs: { type: Number, default: 0 },
    logs: { type: [String], default: [] },
    executedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    executorName: { type: String, required: true },
  },
  { timestamps: true }
);

// 10. Defects
const defectCommentSchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User' },
    authorName: { type: String, required: true },
    role: { type: String, required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const defectStatusHistorySchema = new Schema(
  {
    status: { type: String, enum: DEFECT_STATUSES, required: true },
    changedBy: { type: String, required: true },
    note: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const defectSchema = new Schema(
  {
    defectId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    module: { type: String, required: true, index: true },
    description: { type: String, required: true },
    stepsToReproduce: { type: String, required: true },
    expectedResult: { type: String, required: true },
    actualResult: { type: String, required: true },
    severity: { type: String, enum: DEFECT_SEVERITIES, default: 'Major', index: true },
    priority: { type: String, enum: TEST_PRIORITIES, default: 'Medium', index: true },
    status: { type: String, enum: DEFECT_STATUSES, default: 'Open', index: true },
    assignedTo: { type: String, default: 'Unassigned' },
    linkedTestCaseId: { type: Schema.Types.ObjectId, ref: 'TestCase', default: null },
    linkedExecutionId: { type: Schema.Types.ObjectId, ref: 'TestExecution', default: null },
    evidenceScreenshot: { type: String, default: '' },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reportedByName: { type: String, required: true },
    reportedDate: { type: Date, default: Date.now },
    comments: [defectCommentSchema],
    statusHistory: [defectStatusHistorySchema],
  },
  { timestamps: true }
);

// 11. Requirements
const requirementSchema = new Schema(
  {
    reqId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    module: { type: String, required: true, index: true },
    priority: { type: String, enum: TEST_PRIORITIES, default: 'High' },
    linkedTestCaseIds: [{ type: Schema.Types.ObjectId, ref: 'TestCase' }],
    isSeeded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 12. QA Reports
const qaReportSchema = new Schema(
  {
    reportId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    generatedByName: { type: String, required: true },
    dateFrom: { type: String, default: '' },
    dateTo: { type: String, default: '' },
    moduleFilter: { type: String, default: 'All' },
    summarySnapshot: { type: Schema.Types.Mixed, required: true },
    observations: { type: String, default: '' },
    qualityAssessment: { type: String, default: '' },
  },
  { timestamps: true }
);

// 13. API Test History
const apiTestHistorySchema = new Schema(
  {
    method: { type: String, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], required: true },
    endpoint: { type: String, required: true },
    requestHeaders: { type: Schema.Types.Mixed, default: {} },
    requestBody: { type: Schema.Types.Mixed, default: null },
    statusCode: { type: Number, required: true },
    responseTimeMs: { type: Number, required: true },
    responseBody: { type: Schema.Types.Mixed, default: null },
    executedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    executorName: { type: String },
  },
  { timestamps: true }
);

// 14. Audit Logs
const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, required: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true },
    module: { type: String, required: true, index: true },
    entityType: { type: String, default: '' },
    entityId: { type: String, default: '' },
    details: { type: String, default: '' },
  },
  { timestamps: true }
);

// 15. Non-Functional Testing Records
const nonFunctionalTestSchema = new Schema(
  {
    category: {
      type: String,
      enum: [
        'Performance Testing',
        'Usability Testing',
        'Security Testing',
        'Compatibility Testing',
        'Reliability Testing',
        'Database Testing',
      ],
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    metricName: { type: String, required: true },
    measuredValue: { type: String, required: true },
    threshold: { type: String, required: true },
    status: { type: String, enum: ['Passed', 'Failed', 'Needs Review'], required: true },
    observations: { type: String, required: true },
    evidenceNote: { type: String, default: '' },
    measurementMethod: {
      type: String,
      enum: ['Manual Observation', 'Automated HTTP Benchmark'],
      default: 'Manual Observation',
    },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    recordedByName: { type: String, required: true },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
export const Store = mongoose.model('Store', storeSchema);
export const Product = mongoose.model('Product', productSchema);
export const Cart = mongoose.model('Cart', cartSchema);
export const Address = mongoose.model('Address', addressSchema);
export const Order = mongoose.model('Order', orderSchema);
export const TestSuite = mongoose.model('TestSuite', testSuiteSchema);
export const TestCase = mongoose.model('TestCase', testCaseSchema);
export const TestExecution = mongoose.model('TestExecution', testExecutionSchema);
export const Defect = mongoose.model('Defect', defectSchema);
export const Requirement = mongoose.model('Requirement', requirementSchema);
export const QAReport = mongoose.model('QAReport', qaReportSchema);
export const ApiTestHistory = mongoose.model('ApiTestHistory', apiTestHistorySchema);
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export const NonFunctionalTest = mongoose.model('NonFunctionalTest', nonFunctionalTestSchema);
export type ObjectId = Types.ObjectId;
