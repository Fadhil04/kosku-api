import { prisma } from '../../config/database';
import { sendEmail } from '../../config/email';
import { AppError } from '../../middleware/errorHandler';
import { paymentConfirmedTemplate } from '../../utils/emailTemplates';
import type { CreatePaymentInput } from './payments.schema';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export class PaymentsService {

  // ────────────────────────────────────────────────
  // CREATE PAYMENT — dengan idempotency
  // ────────────────────────────────────────────────
  async createPayment(
    billId: string,
    ownerId: string,
    input: CreatePaymentInput,
  ) {
    // ──────────────────────────────────────────
    // STEP 1: Cek idempotency key terlebih dulu
    // Kalau key ini sudah pernah dipakai, langsung return
    // data yang sudah ada tanpa membuat record baru
    // ──────────────────────────────────────────
    const existingPayment = await prisma.payment.findUnique({
      where: { idempotencyKey: input.idempotency_key },
      include: { bill: true },
    });

    if (existingPayment) {
      // Request duplikat terdeteksi — ini bukan error,
      // ini adalah behavior yang diharapkan dari idempotency
      return {
        payment: existingPayment,
        is_duplicate_request: true,
      };
    }

    // ──────────────────────────────────────────
    // STEP 2: Validasi bill
    // ──────────────────────────────────────────
    const bill = await prisma.bill.findFirst({
      where: { id: billId, room: { property: { ownerId } } },
      include: {
        tenant: { select: { fullName: true, email: true } },
        payments: true,
      },
    });

    if (!bill) {
      throw new AppError('Tagihan tidak ditemukan', 404, 'BILL_NOT_FOUND');
    }

    if (bill.status === 'PAID') {
      throw new AppError(
        'Tagihan ini sudah lunas',
        409,
        'BILL_ALREADY_PAID',
      );
    }

    if (bill.status === 'WAIVED') {
      throw new AppError(
        'Tagihan ini sudah dihapuskan, tidak bisa menerima pembayaran',
        409,
        'BILL_WAIVED',
      );
    }

    // Hitung total yang sudah dibayar sebelumnya
    const totalAlreadyPaid = bill.payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );

    const remainingAmount =
      Number(bill.totalAmount) - Number(bill.discountAmount) - totalAlreadyPaid;

    if (input.amount > remainingAmount) {
      throw new AppError(
        `Jumlah pembayaran (Rp ${input.amount.toLocaleString('id-ID')}) melebihi sisa tagihan ` +
          `(Rp ${remainingAmount.toLocaleString('id-ID')})`,
        422,
        'BILL_PAYMENT_EXCEEDS_AMOUNT',
      );
    }

    // ──────────────────────────────────────────
    // STEP 3: Transaction — simpan payment dan update status bill
    // ──────────────────────────────────────────
    const newTotalPaid = totalAlreadyPaid + input.amount;
    const billTotalAfterDiscount =
      Number(bill.totalAmount) - Number(bill.discountAmount);
    const isFullyPaid = newTotalPaid >= billTotalAfterDiscount;

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          billId,
          idempotencyKey: input.idempotency_key,
          amount: input.amount,
          paymentMethod: input.payment_method,
          paymentDate: input.payment_date,
          referenceNumber: input.reference_number,
          proofUrl: input.proof_url,
          notes: input.notes,
          recordedBy: ownerId,
        },
      });

      const updatedBill = await tx.bill.update({
        where: { id: billId },
        data: {
          status: isFullyPaid ? 'PAID' : 'PARTIALLY_PAID',
          ...(isFullyPaid && { paidAt: new Date() }),
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'payment',
          entityId: payment.id,
          action: 'CREATED',
          newValues: {
            billId,
            amount: input.amount,
            method: input.payment_method,
          },
          performedBy: ownerId,
          performerRole: 'owner',
        },
      });

      return { payment, updatedBill };
    });

    // Email dikirim setelah transaction berhasil
    const periodLabel = `${MONTH_NAMES[bill.periodMonth - 1]} ${bill.periodYear}`;
    const template = paymentConfirmedTemplate({
      fullName: bill.tenant.fullName,
      periodLabel,
      amountPaid: input.amount.toLocaleString('id-ID'),
      paymentDate: input.payment_date.toLocaleDateString('id-ID'),
      referenceNumber: input.reference_number,
    });

    await sendEmail({
      to: bill.tenant.email,
      subject: template.subject,
      html: template.html,
    }).catch((err) => {
      console.error('Gagal mengirim email konfirmasi pembayaran:', err);
    });

    return {
      payment: result.payment,
      bill_status: result.updatedBill.status,
      is_duplicate_request: false,
    };
  }

  // ────────────────────────────────────────────────
  // GET PAYMENTS FOR A BILL
  // ────────────────────────────────────────────────
  async getPaymentsByBillId(billId: string, ownerId: string) {
    const bill = await prisma.bill.findFirst({
      where: { id: billId, room: { property: { ownerId } } },
    });

    if (!bill) {
      throw new AppError('Tagihan tidak ditemukan', 404, 'BILL_NOT_FOUND');
    }

    const payments = await prisma.payment.findMany({
      where: { billId },
      orderBy: { createdAt: 'desc' },
    });

    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      payments,
      total_paid: totalPaid,
      remaining_amount:
        Number(bill.totalAmount) - Number(bill.discountAmount) - totalPaid,
    };
  }

  // ────────────────────────────────────────────────
  // GET PAYMENT DETAIL
  // ────────────────────────────────────────────────
  async getPaymentById(paymentId: string, ownerId: string) {
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        bill: { room: { property: { ownerId } } },
      },
      include: {
        bill: {
          include: {
            tenant: { select: { fullName: true } },
            room: { select: { roomNumber: true } },
          },
        },
      },
    });

    if (!payment) {
      throw new AppError(
        'Data pembayaran tidak ditemukan',
        404,
        'PAYMENT_NOT_FOUND',
      );
    }

    return payment;
  }
}

export const paymentsService = new PaymentsService();