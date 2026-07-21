import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { getPagination, getPaginationMeta } from '../../utils/pagination';
import { calculateLateFee } from '../../utils/lateFee.calculator';
import type {
  BillQueryInput,
  OverdueBillQueryInput,
  DiscountBillInput,
  WaiveBillInput,
} from './bills.schema';

export class BillsService {

  // ────────────────────────────────────────────────
  // GET ALL BILLS (akses berbeda untuk owner dan tenant)
  // ────────────────────────────────────────────────
  async getBills(
    userId: string,
    role: 'owner' | 'tenant',
    query: BillQueryInput,
  ) {
    const { skip, take, page, limit } = getPagination(query);

    const where: Record<string, unknown> = {
      ...(role === 'owner' && {
        room: { property: { ownerId: userId } },
      }),
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
        where,
        skip,
        take,
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        include: {
          tenant: { select: { id: true, fullName: true } },
          room: { select: { roomNumber: true } },
          property: { select: { name: true } },
        },
      }),
      prisma.bill.count({ where }),
    ]);

    const billsWithLateFee = bills.map((bill) => this.attachLateFeeInfo(bill));

    return {
      data: billsWithLateFee,
      meta: getPaginationMeta(total, page, limit),
    };
  }

  // ────────────────────────────────────────────────
  // GET BILL DETAIL
  // ────────────────────────────────────────────────
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
        property: { select: { name: true } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!bill) {
      throw new AppError('Tagihan tidak ditemukan', 404, 'BILL_NOT_FOUND');
    }

    return this.attachLateFeeInfo(bill);
  }

  // ────────────────────────────────────────────────
  // GET OVERDUE BILLS
  // ────────────────────────────────────────────────
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
        property: { select: { name: true } },
      },
    });

    const withLateFee = bills
      .map((bill) => this.attachLateFeeInfo(bill))
      .filter((bill) => bill.late_fee_info.days_overdue >= query.min_days_overdue);

    return withLateFee;
  }

  // ────────────────────────────────────────────────
  // APPLY DISCOUNT
  // ────────────────────────────────────────────────
  async applyDiscount(
    billId: string,
    ownerId: string,
    input: DiscountBillInput,
  ) {
    const bill = await this.verifyBillOwnership(billId, ownerId);

    if (bill.status === 'PAID' || bill.status === 'WAIVED') {
      throw new AppError(
        'Tidak bisa memberi diskon pada tagihan yang sudah lunas atau dihapuskan',
        409,
        'BILL_ALREADY_FINALIZED',
      );
    }

    if (input.discount_amount > Number(bill.totalAmount)) {
      throw new AppError(
        'Jumlah diskon tidak boleh melebihi total tagihan',
        400,
        'DISCOUNT_EXCEEDS_TOTAL',
      );
    }

    const updated = await prisma.bill.update({
      where: { id: billId },
      data: {
        discountAmount: input.discount_amount,
        discountReason: input.discount_reason,
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'bill',
        entityId: billId,
        action: 'DISCOUNT_APPLIED',
        oldValues: { discountAmount: bill.discountAmount },
        newValues: {
          discountAmount: input.discount_amount,
          reason: input.discount_reason,
        },
        performedBy: ownerId,
        performerRole: 'owner',
      },
    });

    return this.attachLateFeeInfo(updated);
  }

  // ────────────────────────────────────────────────
  // WAIVE BILL
  // ────────────────────────────────────────────────
  async waiveBill(billId: string, ownerId: string, input: WaiveBillInput) {
    const bill = await this.verifyBillOwnership(billId, ownerId);

    if (bill.status === 'PAID') {
      throw new AppError(
        'Tidak bisa menghapuskan tagihan yang sudah lunas',
        409,
        'BILL_ALREADY_PAID',
      );
    }

    const updated = await prisma.bill.update({
      where: { id: billId },
      data: {
        status: 'WAIVED',
        notes: input.reason,
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'bill',
        entityId: billId,
        action: 'WAIVED',
        oldValues: { status: bill.status },
        newValues: { status: 'WAIVED', reason: input.reason },
        performedBy: ownerId,
        performerRole: 'owner',
      },
    });

    return updated;
  }

  // ────────────────────────────────────────────────
  // HELPER: Tempel info late fee ke object bill
  // ────────────────────────────────────────────────
  private attachLateFeeInfo<T extends {
    totalAmount: unknown;
    dueDate: Date;
    lateFeePercentage: unknown;
    lateFeeMaxPercentage: unknown;
    status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'WAIVED';
    discountAmount: unknown;
  }>(bill: T) {
    const totalAmount = Number(bill.totalAmount);
    const discountAmount = Number(bill.discountAmount);
    const amountAfterDiscount = totalAmount - discountAmount;

    const lateFeeResult = calculateLateFee({
      totalAmount: amountAfterDiscount,
      dueDate: bill.dueDate,
      lateFeePercentage: Number(bill.lateFeePercentage),
      lateFeeMaxPercentage: Number(bill.lateFeeMaxPercentage),
      status: bill.status,
    });

    return {
      ...bill,
      amount_after_discount: amountAfterDiscount,
      late_fee_info: {
        days_overdue: lateFeeResult.daysOverdue,
        late_fee_percentage: lateFeeResult.lateFeePercentageApplied,
        late_fee_amount: lateFeeResult.lateFeeAmount,
        is_overdue: lateFeeResult.isOverdue,
      },
      final_amount: lateFeeResult.finalAmount,
    };
  }

  // ────────────────────────────────────────────────
  // HELPER: Verifikasi bill milik owner
  // ────────────────────────────────────────────────
  async verifyBillOwnership(billId: string, ownerId: string) {
    const bill = await prisma.bill.findFirst({
      where: { id: billId, room: { property: { ownerId } } },
    });

    if (!bill) {
      throw new AppError('Tagihan tidak ditemukan', 404, 'BILL_NOT_FOUND');
    }

    return bill;
  }
}

export const billsService = new BillsService();