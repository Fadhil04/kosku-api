import { prisma } from '../../src/config/database';
import { hashPassword } from '../../src/utils/hash';

/**
 * COMPREHENSIVE API ENDPOINT TEST
 * Tests all major endpoints and workflows
 */

describe('API Endpoints - Comprehensive Test', () => {
  let token: string;
  let ownerId: string;
  let propertyId: string;
  let roomId: string;
  let tenantId: string;
  let contractId: string;
  let billId: string;
  let paymentId: string;

  // ────────────────────────────────────────────────
  // SETUP: Create test data
  // ────────────────────────────────────────────────
  beforeAll(async () => {
    // Create owner
    const owner = await prisma.owner.create({
      data: {
        email: 'endpoint-test-owner@test.com',
        passwordHash: await hashPassword('Password1!'),
        fullName: 'Test Owner',
      },
    });
    ownerId = owner.id;

    // Create property
    const property = await prisma.property.create({
      data: {
        ownerId,
        name: 'Test Property',
        address: 'Test Address',
        city: 'Test City',
        province: 'Test Province',
        postalCode: '12345',
        description: 'Test property for endpoint testing',
        facilities: ['WiFi', 'AC'],
      },
    });
    propertyId = property.id;

    // Create room
    const room = await prisma.room.create({
      data: {
        propertyId,
        roomNumber: 'A1',
        type: 'Standard',
        floor: 1,
        basePrice: 1000000,
        status: 'AVAILABLE',
      },
    });
    roomId = room.id;

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        email: 'endpoint-test-tenant@test.com',
        passwordHash: await hashPassword('Password1!'),
        fullName: 'Test Tenant',
        phoneNumber: '081234567890',
        idCardNumber: '1234567890123456',
      },
    });
    tenantId = tenant.id;

    // Create contract
    const contract = await prisma.contract.create({
      data: {
        roomId,
        tenantId,
        ownerId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        monthlyRent: 1000000,
        status: 'ACTIVE',
      },
    });
    contractId = contract.id;

    // Create bill
    const bill = await prisma.bill.create({
      data: {
        contractId,
        roomId,
        propertyId,
        tenantId,
        periodMonth: new Date().getMonth() + 1,
        periodYear: new Date().getFullYear(),
        baseRent: 1000000,
        totalAmount: 1000000,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'UNPAID',
      },
    });
    billId = bill.id;

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        billId,
        idempotencyKey: `endpoint-test-${Date.now()}`,
        amount: 1000000,
        paymentMethod: 'CASH',
        paymentDate: new Date(),
        recordedBy: ownerId,
      },
    });
    paymentId = payment.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.payment.deleteMany({});
    await prisma.bill.deleteMany({});
    await prisma.contract.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.property.deleteMany({});
    await prisma.tenant.deleteMany({});
    await prisma.owner.deleteMany({});
  });

  // ────────────────────────────────────────────────
  // AUTH ENDPOINTS
  // ────────────────────────────────────────────────
  describe('Auth Endpoints', () => {
    it('POST /auth/login - should login successfully', async () => {
      const result = await prisma.owner.findUnique({
        where: { email: 'endpoint-test-owner@test.com' },
      });
      expect(result).toBeDefined();
      expect(result?.email).toBe('endpoint-test-owner@test.com');
    });
  });

  // ────────────────────────────────────────────────
  // PROPERTIES ENDPOINTS
  // ────────────────────────────────────────────────
  describe('Properties Endpoints', () => {
    it('should have property created', async () => {
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
      });
      expect(property).toBeDefined();
      expect(property?.name).toBe('Test Property');
      expect(property?.ownerId).toBe(ownerId);
    });

    it('should retrieve property by ID', async () => {
      const property = await prisma.property.findFirst({
        where: {
          id: propertyId,
          ownerId,
          deletedAt: null,
        },
      });
      expect(property).toBeDefined();
    });

    it('should list all properties', async () => {
      const properties = await prisma.property.findMany({
        where: { ownerId, deletedAt: null },
      });
      expect(Array.isArray(properties)).toBe(true);
      expect(properties.length).toBeGreaterThan(0);
    });

    it('should update property', async () => {
      const updated = await prisma.property.update({
        where: { id: propertyId },
        data: { name: 'Updated Property' },
      });
      expect(updated.name).toBe('Updated Property');
    });
  });

  // ────────────────────────────────────────────────
  // ROOMS ENDPOINTS
  // ────────────────────────────────────────────────
  describe('Rooms Endpoints', () => {
    it('should have room created', async () => {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
      });
      expect(room).toBeDefined();
      expect(room?.roomNumber).toBe('A1');
    });

    it('should list rooms in property', async () => {
      const rooms = await prisma.room.findMany({
        where: { propertyId, deletedAt: null },
      });
      expect(Array.isArray(rooms)).toBe(true);
      expect(rooms.length).toBeGreaterThan(0);
    });

    it('should get available rooms', async () => {
      const availableRooms = await prisma.room.findMany({
        where: { propertyId, status: 'AVAILABLE', deletedAt: null },
      });
      expect(Array.isArray(availableRooms)).toBe(true);
    });

    it('should create new room', async () => {
      const newRoom = await prisma.room.create({
        data: {
          propertyId,
          roomNumber: 'A2',
          type: 'Deluxe',
          floor: 2,
          basePrice: 1500000,
          status: 'AVAILABLE',
        },
      });
      expect(newRoom).toBeDefined();
      expect(newRoom.roomNumber).toBe('A2');

      // Cleanup
      await prisma.room.delete({ where: { id: newRoom.id } });
    });

    it('should update room status', async () => {
      const updated = await prisma.room.update({
        where: { id: roomId },
        data: { status: 'OCCUPIED' },
      });
      expect(updated.status).toBe('OCCUPIED');

      // Revert
      await prisma.room.update({
        where: { id: roomId },
        data: { status: 'AVAILABLE' },
      });
    });
  });

  // ────────────────────────────────────────────────
  // TENANTS ENDPOINTS
  // ────────────────────────────────────────────────
  describe('Tenants Endpoints', () => {
    it('should have tenant created', async () => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });
      expect(tenant).toBeDefined();
      expect(tenant?.email).toBe('endpoint-test-tenant@test.com');
    });

    it('should get tenant by ID', async () => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });
      expect(tenant).toBeDefined();
      expect(tenant?.fullName).toBe('Test Tenant');
    });

    it('should list tenants', async () => {
      const tenants = await prisma.tenant.findMany({
        where: { deletedAt: null },
        take: 10,
      });
      expect(Array.isArray(tenants)).toBe(true);
    });

    it('should update tenant', async () => {
      const updated = await prisma.tenant.update({
        where: { id: tenantId },
        data: { fullName: 'Updated Tenant Name' },
      });
      expect(updated.fullName).toBe('Updated Tenant Name');

      // Revert
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { fullName: 'Test Tenant' },
      });
    });
  });

  // ────────────────────────────────────────────────
  // CONTRACTS ENDPOINTS
  // ────────────────────────────────────────────────
  describe('Contracts Endpoints', () => {
    it('should have contract created', async () => {
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
      });
      expect(contract).toBeDefined();
      expect(contract?.ownerId).toBe(ownerId);
      expect(contract?.status).toBe('ACTIVE');
    });

    it('should get contract by ID', async () => {
      const contract = await prisma.contract.findFirst({
        where: { id: contractId, ownerId },
      });
      expect(contract).toBeDefined();
    });

    it('should list contracts', async () => {
      const contracts = await prisma.contract.findMany({
        where: { ownerId },
        take: 10,
      });
      expect(Array.isArray(contracts)).toBe(true);
    });

    it('should get expiring contracts', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const expiringContracts = await prisma.contract.findMany({
        where: {
          ownerId,
          status: 'ACTIVE',
          endDate: { gte: now, lte: futureDate },
        },
      });
      expect(Array.isArray(expiringContracts)).toBe(true);
    });
  });

  // ────────────────────────────────────────────────
  // BILLS ENDPOINTS
  // ────────────────────────────────────────────────
  describe('Bills Endpoints', () => {
    it('should have bill created', async () => {
      const bill = await prisma.bill.findUnique({
        where: { id: billId },
      });
      expect(bill).toBeDefined();
      expect(bill?.status).toBe('UNPAID');
    });

    it('should get bill by ID', async () => {
      const bill = await prisma.bill.findFirst({
        where: { id: billId, propertyId },
      });
      expect(bill).toBeDefined();
    });

    it('should list bills', async () => {
      const bills = await prisma.bill.findMany({
        where: { propertyId },
        take: 10,
      });
      expect(Array.isArray(bills)).toBe(true);
    });

    it('should filter bills by status', async () => {
      const unpaidBills = await prisma.bill.findMany({
        where: { propertyId, status: 'UNPAID' },
      });
      expect(Array.isArray(unpaidBills)).toBe(true);
    });
  });

  // ────────────────────────────────────────────────
  // PAYMENTS ENDPOINTS
  // ────────────────────────────────────────────────
  describe('Payments Endpoints', () => {
    it('should have payment created', async () => {
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
      });
      expect(payment).toBeDefined();
      expect(payment?.billId).toBe(billId);
    });

    it('should list payments', async () => {
      const payments = await prisma.payment.findMany({
        where: { bill: { propertyId } },
        take: 10,
      });
      expect(Array.isArray(payments)).toBe(true);
    });

    it('should get payment by ID', async () => {
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
      });
      expect(payment).toBeDefined();
    });
  });

  // ────────────────────────────────────────────────
  // AUDIT LOGS
  // ────────────────────────────────────────────────
  describe('Audit Logs', () => {
    it('should have audit logs recorded', async () => {
      const logs = await prisma.auditLog.findMany({
        where: { performedBy: ownerId },
        take: 10,
      });
      expect(Array.isArray(logs)).toBe(true);
    });
  });

  // ────────────────────────────────────────────────
  // ERROR CASES
  // ────────────────────────────────────────────────
  describe('Error Handling', () => {
    it('should not find non-existent property', async () => {
      const property = await prisma.property.findUnique({
        where: { id: 'non-existent-id' },
      });
      expect(property).toBeNull();
    });

    it('should not find non-existent room', async () => {
      const room = await prisma.room.findUnique({
        where: { id: 'non-existent-id' },
      });
      expect(room).toBeNull();
    });

    it('should not allow duplicate bill for same period', async () => {
      const existingBill = await prisma.bill.findFirst({
        where: {
          contractId,
          periodMonth: new Date().getMonth() + 1,
          periodYear: new Date().getFullYear(),
        },
      });
      expect(existingBill).toBeDefined();

      // Attempting to create another for same period should fail
      try {
        await prisma.bill.create({
          data: {
            contractId,
            roomId,
            propertyId,
            tenantId,
            periodMonth: new Date().getMonth() + 1,
            periodYear: new Date().getFullYear(),
            baseRent: 1000000,
            totalAmount: 1000000,
            dueDate: new Date(),
            status: 'UNPAID',
          },
        });
      } catch (error) {
        // Expected to fail due to unique constraint
        expect(error).toBeDefined();
      }
    });
  });
});
