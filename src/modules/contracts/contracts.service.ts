import { prisma } from '../../config/database';
import { sendEmail } from '../../config/email';
import { AppError } from '../../middleware/errorHandler';
import { getPagination, getPaginationMeta } from '../../utils/pagination';
import { generateBillsForContract } from '../../utils/billGenerator';
import { contractCreatedTenantTemplate } from '../../utils/emailTemplates';
import type {
  CreateContractInput,
  TerminateContractInput,
  RenewContractInput,
  ContractQueryInput,
  ExpiringContractQueryInput,
} from './contracts.schema';

// ── Helper: normalize contract dari Prisma ke snake_case ──────────
function normalizeContract(c: {
  id: string;
  roomId: string;
  tenantId: string;
  ownerId: string;
  startDate: Date;
  endDate: Date;
  monthlyRent: unknown;
  depositAmount: unknown;
  depositStatus: string;
  billingDate: number;
  additionalCharges: unknown;
  status: string;
  terminationDate?: Date | null;
  terminationReason?: string | null;
  terminatedBy?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  tenant?: {
    id: string;
    fullName: string;
    email: string;
    phoneNumber?: string | null;
  };
  room?: {
    roomNumber: string;
    property?: { id: string; name: string };
  };
  _count?: { bills: number };
  [key: string]: unknown;
}) {
  return {
    id: c.id,
    room_id: c.roomId,
    tenant_id: c.tenantId,
    owner_id: c.ownerId,
    start_date: c.startDate,
    end_date: c.endDate,
    monthly_rent: Number(c.monthlyRent),
    deposit_amount: Number(c.depositAmount),
    deposit_status: c.depositStatus,
    billing_date: c.billingDate,
    additional_charges: c.additionalCharges,
    status: c.status,
    termination_date: c.terminationDate ?? null,
    termination_reason: c.terminationReason ?? null,
    notes: c.notes ?? null,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
    ...(c.tenant && {
      tenant: {
        id: c.tenant.id,
        full_name: c.tenant.fullName,
        email: c.tenant.email,
        phone_number: c.tenant.phoneNumber ?? null,
      },
    }),
    ...(c.room && {
      room: {
        room_number: c.room.roomNumber,
        ...(c.room.property && {
          property: { id: c.room.property.id, name: c.room.property.name },
        }),
      },
    }),
    ...('_count' in c && c._count ? { _count: c._count } : {}),
  };
}

export class ContractsService {
  // ------------------------------------------------
  // CREATE CONTRACT
  // ------------------------------------------------
  async createContract(ownerId: string, input: CreateContractInput) {
    const room = await prisma.room.findFirst({
      where: { id: input.room_id, deletedAt: null },
      include: { property: true },
    });

    if (!room) throw new AppError('Kamar tidak ditemukan', 404, 'ROOM_NOT_FOUND');
    if (room.property.ownerId !== ownerId) {
      throw new AppError('Kamu tidak memiliki akses ke kamar ini', 403, 'ROOM_ACCESS_DENIED');
    }
    if (room.status !== 'AVAILABLE') {
      throw new AppError(
        `Kamar ${room.roomNumber} sedang tidak tersedia (status: ${room.status})`,
        422,
        'ROOM_NOT_AVAILABLE',
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: input.tenant_id, deletedAt: null },
    });
    if (!tenant) throw new AppError('Penghuni tidak ditemukan', 404, 'TENANT_NOT_FOUND');

    const existingActiveContract = await prisma.contract.findFirst({
      where: { tenantId: input.tenant_id, ownerId, status: 'ACTIVE' },
    });
    if (existingActiveContract) {
      throw new AppError(
        'Penghuni ini masih memiliki kontrak aktif di kamar lain. Akhiri kontrak lama terlebih dahulu.',
        409,
        'TENANT_HAS_ACTIVE_CONTRACT',
      );
    }

    const billsToCreate = generateBillsForContract({
      contractId: '',
      tenantId: input.tenant_id,
      roomId: input.room_id,
      propertyId: room.propertyId,
      startDate: input.start_date,
      endDate: input.end_date,
      billingDate: input.billing_date,
      monthlyRent: input.monthly_rent,
      additionalCharges: input.additional_charges,
    });

    const result = await prisma.$transaction(async (tx) => {
      const contract = await tx.contract.create({
        data: {
          roomId: input.room_id,
          tenantId: input.tenant_id,
          ownerId,
          startDate: input.start_date,
          endDate: input.end_date,
          monthlyRent: input.monthly_rent,
          depositAmount: input.deposit_amount,
          depositStatus: input.deposit_amount > 0 ? 'UNPAID' : 'PAID',
          billingDate: input.billing_date,
          additionalCharges: input.additional_charges,
          notes: input.notes,
          status: 'ACTIVE',
        },
      });

      await tx.room.update({ where: { id: input.room_id }, data: { status: 'OCCUPIED' } });

      const billsWithContractId = billsToCreate.map((bill) => ({
        ...bill,
        contractId: contract.id,
        additionalCharges: bill.additionalCharges as unknown as object,
      }));
      await tx.bill.createMany({ data: billsWithContractId });

      await tx.auditLog.create({
        data: {
          entityType: 'contract',
          entityId: contract.id,
          action: 'CREATED',
          newValues: {
            roomId: input.room_id,
            tenantId: input.tenant_id,
            startDate: input.start_date,
            endDate: input.end_date,
            monthlyRent: input.monthly_rent,
          },
          performedBy: ownerId,
          performerRole: 'owner',
        },
      });

      return { contract, billsCount: billsWithContractId.length };
    });

    await sendEmail({
      to: tenant.email,
      subject: contractCreatedTenantTemplate({
        fullName: tenant.fullName,
        propertyName: room.property.name,
        roomNumber: room.roomNumber,
        startDate: input.start_date.toLocaleDateString('id-ID'),
        endDate: input.end_date.toLocaleDateString('id-ID'),
        monthlyRent: input.monthly_rent.toLocaleString('id-ID'),
      }).subject,
      html: contractCreatedTenantTemplate({
        fullName: tenant.fullName,
        propertyName: room.property.name,
        roomNumber: room.roomNumber,
        startDate: input.start_date.toLocaleDateString('id-ID'),
        endDate: input.end_date.toLocaleDateString('id-ID'),
        monthlyRent: input.monthly_rent.toLocaleString('id-ID'),
      }).html,
    }).catch((err) => console.error('Gagal mengirim email konfirmasi kontrak:', err));

    return {
      ...normalizeContract(result.contract),
      bills_generated: result.billsCount,
    };
  }

  // ────────────────────────────────────────────────
  // GET ALL CONTRACTS
  // ────────────────────────────────────────────────
  async getContracts(ownerId: string, query: ContractQueryInput) {
    const { skip, take, page, limit } = getPagination(query);

    const where = {
      ownerId,
      ...(query.room_id && { roomId: query.room_id }),
      ...(query.tenant_id && { tenantId: query.tenant_id }),
      ...(query.status && { status: query.status }),
      ...(query.property_id && { room: { propertyId: query.property_id } }),
    };

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { id: true, fullName: true, email: true, phoneNumber: true } },
          room: {
            select: {
              roomNumber: true,
              property: { select: { id: true, name: true } },
            },
          },
          _count: { select: { bills: true } },
        },
      }),
      prisma.contract.count({ where }),
    ]);

    return {
      data: contracts.map(normalizeContract),
      meta: getPaginationMeta(total, page, limit),
    };
  }

  // ────────────────────────────────────────────────
  // GET CONTRACT DETAIL
  // ────────────────────────────────────────────────
  async getContractById(contractId: string, ownerId: string) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, ownerId },
      include: {
        tenant: { select: { id: true, fullName: true, email: true, phoneNumber: true } },
        room: {
          include: { property: { select: { id: true, name: true, address: true } } },
        },
        bills: {
          orderBy: [{ periodYear: 'asc' }, { periodMonth: 'asc' }],
          include: {
            payments: { select: { id: true, amount: true, paymentDate: true } },
          },
        },
      },
    });

    if (!contract) throw new AppError('Kontrak tidak ditemukan', 404, 'CONTRACT_NOT_FOUND');

    return {
      ...normalizeContract(contract),
      bills: contract.bills.map((b) => ({
        id: b.id,
        period_month: b.periodMonth,
        period_year: b.periodYear,
        due_date: b.dueDate,
        base_rent: Number(b.baseRent),
        total_amount: Number(b.totalAmount),
        discount_amount: Number(b.discountAmount),
        status: b.status,
        paid_at: b.paidAt,
        payments: b.payments.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          payment_date: p.paymentDate,
        })),
      })),
    };
  }

  // ────────────────────────────────────────────────
  // GET EXPIRING CONTRACTS
  // ────────────────────────────────────────────────
  async getExpiringContracts(ownerId: string, query: ExpiringContractQueryInput) {
    const now = new Date();
    const futureDate = new Date(now.getTime() + query.days * 24 * 60 * 60 * 1000);

    const contracts = await prisma.contract.findMany({
      where: {
        ownerId,
        status: 'ACTIVE',
        endDate: { gte: now, lte: futureDate },
        ...(query.property_id && { room: { propertyId: query.property_id } }),
      },
      orderBy: { endDate: 'asc' },
      include: {
        tenant: { select: { id: true, fullName: true, email: true, phoneNumber: true } },
        room: {
          select: {
            roomNumber: true,
            property: { select: { id: true, name: true } },
          },
        },
      },
    });

    return contracts.map((c) => ({
      ...normalizeContract(c),
      days_remaining: Math.ceil((c.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    }));
  }

  // ────────────────────────────────────────────────
  // TERMINATE CONTRACT
  // ────────────────────────────────────────────────
  async terminateContract(contractId: string, ownerId: string, input: TerminateContractInput) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, ownerId },
      include: { room: true, tenant: true },
    });

    if (!contract) throw new AppError('Kontrak tidak ditemukan', 404, 'CONTRACT_NOT_FOUND');
    if (contract.status === 'TERMINATED') {
      throw new AppError('Kontrak ini sudah diterminasi', 409, 'CONTRACT_ALREADY_TERMINATED');
    }
    if (contract.status === 'EXPIRED') {
      throw new AppError('Kontrak yang sudah berakhir tidak bisa diterminasi', 409, 'CONTRACT_ALREADY_EXPIRED');
    }

    const depositStatus =
      input.deposit_action === 'REFUND_FULL' || input.deposit_action === 'REFUND_PARTIAL'
        ? 'REFUNDED'
        : contract.depositStatus;

    const result = await prisma.$transaction(async (tx) => {
      const updatedContract = await tx.contract.update({
        where: { id: contractId },
        data: {
          status: 'TERMINATED',
          terminationDate: input.termination_date,
          terminationReason: input.termination_reason,
          terminatedBy: ownerId,
          depositStatus,
        },
      });

      await tx.room.update({ where: { id: contract.roomId }, data: { status: 'NEEDS_MAINTENANCE' } });

      const cancelledBills = await tx.bill.updateMany({
        where: {
          contractId,
          dueDate: { gt: input.termination_date },
          status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
        },
        data: {
          status: 'WAIVED',
          notes: `Dibatalkan otomatis karena kontrak diterminasi pada ${input.termination_date.toLocaleDateString('id-ID')}`,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'contract',
          entityId: contractId,
          action: 'TERMINATED',
          oldValues: { status: contract.status },
          newValues: { status: 'TERMINATED', terminationDate: input.termination_date, reason: input.termination_reason },
          performedBy: ownerId,
          performerRole: 'owner',
        },
      });

      return { updatedContract, cancelledBillsCount: cancelledBills.count };
    });

    return {
      ...normalizeContract(result.updatedContract),
      cancelled_bills: result.cancelledBillsCount,
    };
  }

  // ────────────────────────────────────────────────
  // RENEW CONTRACT
  // ────────────────────────────────────────────────
  async renewContract(contractId: string, ownerId: string, input: RenewContractInput) {
    const contract = await prisma.contract.findFirst({ where: { id: contractId, ownerId } });
    if (!contract) throw new AppError('Kontrak tidak ditemukan', 404, 'CONTRACT_NOT_FOUND');
    if (contract.status !== 'ACTIVE' && contract.status !== 'EXPIRED') {
      throw new AppError('Hanya kontrak aktif atau yang sudah berakhir yang bisa diperpanjang', 422, 'CONTRACT_CANNOT_RENEW');
    }
    if (input.new_end_date <= contract.endDate) {
      throw new AppError('Tanggal selesai baru harus lebih lambat dari tanggal selesai saat ini', 400, 'INVALID_RENEWAL_DATE');
    }

    const newMonthlyRent = input.new_monthly_rent || Number(contract.monthlyRent);
    const additionalCharges = contract.additionalCharges as unknown as Array<{ name: string; amount: number }>;
    const room = await prisma.room.findUnique({ where: { id: contract.roomId } });

    const additionalBills = generateBillsForContract({
      contractId: contract.id,
      tenantId: contract.tenantId,
      roomId: contract.roomId,
      propertyId: room!.propertyId,
      startDate: new Date(contract.endDate.getFullYear(), contract.endDate.getMonth() + 1, 1),
      endDate: input.new_end_date,
      billingDate: contract.billingDate,
      monthlyRent: newMonthlyRent,
      additionalCharges,
    });

    const result = await prisma.$transaction(async (tx) => {
      const updatedContract = await tx.contract.update({
        where: { id: contractId },
        data: { endDate: input.new_end_date, monthlyRent: newMonthlyRent, status: 'ACTIVE' },
      });

      if (additionalBills.length > 0) {
        await tx.bill.createMany({
          data: additionalBills.map((bill) => ({
            ...bill,
            additionalCharges: bill.additionalCharges as unknown as object,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: 'contract',
          entityId: contractId,
          action: 'RENEWED',
          oldValues: { endDate: contract.endDate, monthlyRent: contract.monthlyRent },
          newValues: { endDate: input.new_end_date, monthlyRent: newMonthlyRent },
          performedBy: ownerId,
          performerRole: 'owner',
        },
      });

      return { updatedContract, newBillsCount: additionalBills.length };
    });

    return {
      ...normalizeContract(result.updatedContract),
      new_bills_generated: result.newBillsCount,
    };
  }
}

export const contractsService = new ContractsService();
