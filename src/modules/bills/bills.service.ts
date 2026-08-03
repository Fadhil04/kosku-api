import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { getPagination, getPaginationMeta } from '../../utils/pagination';
import { checkOverdue } from '../../utils/overdueChecker';
import type {
  BillQueryInput,
  OverdueBillQueryInput,
  DiscountBillInput,
  WaiveBillInput,
} from './bills.schema';

export class BillsService {
  // ─────────────────────────────────────────────
  // GET ALL BILLS
  // ─────────────────────────────────────────────
  async getBills(userId: string, role: 'owner' | 'tenant', query: BillQueryInput) {
    const { skip, take, page, limit } = getPagination(query);

    const where: Record<string, unknown> = {
      ...(role === 'owner' && { room: { property: { ownerId: userId } } }),
      ...(role === 'tenant' && { tenantId: userId }),
      ...(query.property_id && { propertyId: query.property_id }),
      ...(query.tenant_id && role === 'owner' && { tenantId: query.tenant_id }),
      ...(query.room_id && { roomId: query.room_id }),
      ...(query.status && { status: query.status }),
      ...(query.month && { periodMonth: query.month }),
      ...(query.year && { periodYear: query.year }),
    };

    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where, skip, take,
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        include: {
          tenant: { select: { id: true, fullName: true, email: true } },
          room: { select: { roomNumber: true } },
          property: { select: { id: true, name: true } },
        },
      }),
      prisma.bill.count({ where }),
    ]);

    return {
      data: bills.map((b) => this.normalizeBill(b)),
      meta: getPaginationMeta(total, page, limit),
    };
  }

  // ─────────────────────────────────────────────
  // GET BILL DETAIL
  // ─────────────────────────────────────────────
  async getBillById(billId: string, userId: string, role: 'owner' | 'tenant') {
    const bill = await prisma.bill.findFirst({
      where: {
        id: billId,
        ...(role === 'owner' && { room: { property: { ownerId: userId } } }),
        ...(role === 'tenant' && { tenantId: userId }),
      },
      include: {
        tenant: { select: { id: true, fullName: true, email: true } },
        room: { select: { roomNumber: true } },
        property: { select: { id: true, name: true } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!bill) throw new AppError('Tagihan tidak ditemukan', 404, 'BILL_NOT_FOUND');
    return this.normalizeBill(bill as typeof bill & { payments?: unknown[] });
  }

  // ─────────────────────────────────────────────
  // GET OVERDUE BILLS
  // ─────────────────────────────────────────────
  async getOverdueBills(ownerId: string, query: OverdueBillQueryInput) {
    const bills = await prisma.bill.findMany({
      where: {
        room: { property: { ownerId } },
        status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
        dueDate: { lt: new Date() },
        ...(query.property_id && { propertyId: query.property_id }),
      },
      orderBy: { dueDate: 'asc' },
      include: {
        tenant: { select: { id: true, fullName: true, phoneNumber: true, email: true } },
        room: { select: { roomNumber: true } },
        property: { select: { id: true, name: true } },
      },
    });

    return bills
      .map((b) => this.normalizeBill(b))
      .filter((b) => b.overdue_info.days_overdue >= query.min_days_overdue);
  }

  // ─────────────────────────────────────────────
  // APPLY DISCOUNT
  // ─────────────────────────────────────────────
  async applyDiscount(billId: string, ownerId: string, input: DiscountBillInput) {
    const bill = await this.verifyBillOwnership(billId, ownerId);
    if (bill.status === 'PAID' || bill.status === 'WAIVED') {
      throw new AppError('Tidak bisa memberi diskon pada tagihan yang sudah lunas atau dihapuskan', 409, 'BILL_ALREADY_FINALIZED');
    }
    if (input.discount_amount > Number(bill.totalAmount)) {
      throw new AppError('Jumlah diskon tidak boleh melebihi total tagihan', 400, 'DISCOUNT_EXCEEDS_TOTAL');
    }

    const updated = await prisma.bill.update({
      where: { id: billId },
      data: { discountAmount: input.discount_amount, discountReason: input.discount_reason },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'bill', entityId: billId, action: 'DISCOUNT_APPLIED',
        oldValues: { discountAmount: bill.discountAmount },
        newValues: { discountAmount: input.discount_amount, reason: input.discount_reason },
        performedBy: ownerId, performerRole: 'owner',
      },
    });

    return this.normalizeBill(updated);
  }

  // ─────────────────────────────────────────────
  // WAIVE BILL
  // ─────────────────────────────────────────────
  async waiveBill(billId: string, ownerId: string, input: WaiveBillInput) {
    const bill = await this.verifyBillOwnership(billId, ownerId);
    if (bill.status === 'PAID') {
      throw new AppError('Tidak bisa menghapuskan tagihan yang sudah lunas', 409, 'BILL_ALREADY_PAID');
    }

    const updated = await prisma.bill.update({
      where: { id: billId },
      data: { status: 'WAIVED', notes: input.reason },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'bill', entityId: billId, action: 'WAIVED',
        oldValues: { status: bill.status },
        newValues: { status: 'WAIVED', reason: input.reason },
        performedBy: ownerId, performerRole: 'owner',
      },
    });

    return this.normalizeBill(updated);
  }

  // ─────────────────────────────────────────────
  // HELPER: Normalize bill ke snake_case + overdue info
  // (tidak ada denda — hanya informasi keterlambatan)
  // ─────────────────────────────────────────────
  normalizeBill(bill: {
    id: string;
    contractId: string;
    tenantId: string;
    roomId: string;
    propertyId: string;
    periodMonth: number;
    periodYear: number;
    dueDate: Date;
    baseRent: unknown;
    additionalCharges: unknown;
    discountAmount: unknown;
    discountReason?: string | null;
    totalAmount: unknown;
    status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'WAIVED';
    paidAt?: Date | null;
    notes?: string | null;
    createdAt: Date;
    updatedAt: Date;
    tenant?: { id: string; fullName: string; email?: string; phoneNumber?: string | null } | null;
    room?: { roomNumber: string } | null;
    property?: { id: string; name: string } | null;
    payments?: unknown[];
  }) {
    const totalAmount = Number(bill.totalAmount);
    const discountAmount = Number(bill.discountAmount);
    const amountAfterDiscount = totalAmount - discountAmount;

    const overdueInfo = checkOverdue({
      totalAmount: amountAfterDiscount,
      dueDate: bill.dueDate,
      status: bill.status,
    });

    return {
      id: bill.id,
      contract_id: bill.contractId,
      tenant_id: bill.tenantId,
      room_id: bill.roomId,
      property_id: bill.propertyId,
      period_month: bill.periodMonth,
      period_year: bill.periodYear,
      due_date: bill.dueDate,
      base_rent: Number(bill.baseRent),
      additional_charges: bill.additionalCharges,
      discount_amount: discountAmount,
      discount_reason: bill.discountReason ?? null,
      total_amount: totalAmount,
      amount_after_discount: amountAfterDiscount,
      // final_amount = amount_after_discount (tidak ada denda)
      final_amount: overdueInfo.finalAmount,
      status: bill.status,
      paid_at: bill.paidAt ?? null,
      notes: bill.notes ?? null,
      created_at: bill.createdAt,
      updated_at: bill.updatedAt,
      ...(bill.tenant && {
        tenant: {
          id: bill.tenant.id,
          full_name: bill.tenant.fullName,
          email: bill.tenant.email ?? null,
          phone_number: bill.tenant.phoneNumber ?? null,
        },
      }),
      ...(bill.room && { room: { room_number: bill.room.roomNumber } }),
      ...(bill.property && { property: { id: bill.property.id, name: bill.property.name } }),
      ...(bill.payments !== undefined && { payments: bill.payments }),
      // Informasi keterlambatan (tanpa denda)
      overdue_info: {
        days_overdue: overdueInfo.daysOverdue,
        is_overdue: overdueInfo.isOverdue,
      },
      // Alias lama untuk backward compat frontend
      late_fee_info: {
        days_overdue: overdueInfo.daysOverdue,
        is_overdue: overdueInfo.isOverdue,
        late_fee_amount: 0,
        late_fee_percentage: 0,
      },
    };
  }

  async verifyBillOwnership(billId: string, ownerId: string) {
    const bill = await prisma.bill.findFirst({
      where: { id: billId, room: { property: { ownerId } } },
    });
    if (!bill) throw new AppError('Tagihan tidak ditemukan', 404, 'BILL_NOT_FOUND');
    return bill;
  }
}

export const billsService = new BillsService();
