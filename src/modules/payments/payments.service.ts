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
  async createPayment(billId: string, ownerId: string, input: CreatePaymentInput) {
    // Idempotency check
    const existing = await prisma.payment.findUnique({
      where: { idempotencyKey: input.idempotency_key },
      include: { bill: true },
    });
    if (existing) return { payment: existing, is_duplicate_request: true };

    const bill = await prisma.bill.findFirst({
      where: { id: billId, room: { property: { ownerId } } },
      include: { tenant: { select: { fullName: true, email: true } }, payments: true },
    });

    if (!bill) throw new AppError('Tagihan tidak ditemukan', 404, 'BILL_NOT_FOUND');
    if (bill.status === 'PAID') throw new AppError('Tagihan ini sudah lunas', 409, 'BILL_ALREADY_PAID');
    if (bill.status === 'WAIVED') throw new AppError('Tagihan ini sudah dihapuskan', 409, 'BILL_WAIVED');

    const totalAlreadyPaid = bill.payments.reduce((s, p) => s + Number(p.amount), 0);
    const amountAfterDiscount = Number(bill.totalAmount) - Number(bill.discountAmount);
    const remainingAmount = amountAfterDiscount - totalAlreadyPaid;

    if (input.amount > remainingAmount + 1) {
      throw new AppError(
        `Jumlah pembayaran (Rp ${input.amount.toLocaleString('id-ID')}) melebihi sisa tagihan (Rp ${remainingAmount.toLocaleString('id-ID')})`,
        422,
        'BILL_PAYMENT_EXCEEDS_AMOUNT',
      );
    }

    const newTotalPaid = totalAlreadyPaid + input.amount;
    const isFullyPaid = newTotalPaid >= amountAfterDiscount;

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
          entityType: 'payment', entityId: payment.id, action: 'CREATED',
          newValues: { billId, amount: input.amount, method: input.payment_method },
          performedBy: ownerId, performerRole: 'owner',
        },
      });

      return { payment, updatedBill };
    });

    const periodLabel = `${MONTH_NAMES[bill.periodMonth - 1]} ${bill.periodYear}`;
    const template = paymentConfirmedTemplate({
      fullName: bill.tenant.fullName,
      periodLabel,
      amountPaid: input.amount.toLocaleString('id-ID'),
      paymentDate: input.payment_date.toLocaleDateString('id-ID'),
      referenceNumber: input.reference_number,
    });

    await sendEmail({ to: bill.tenant.email, subject: template.subject, html: template.html })
      .catch((err) => console.error('Gagal kirim email konfirmasi bayar:', err));

    return {
      payment: result.payment,
      bill_status: result.updatedBill.status,
      is_duplicate_request: false,
    };
  }

  async getPaymentsByBillId(billId: string, ownerId: string) {
    const bill = await prisma.bill.findFirst({
      where: { id: billId, room: { property: { ownerId } } },
    });
    if (!bill) throw new AppError('Tagihan tidak ditemukan', 404, 'BILL_NOT_FOUND');

    const payments = await prisma.payment.findMany({ where: { billId }, orderBy: { createdAt: 'desc' } });
    const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
    const amountAfterDiscount = Number(bill.totalAmount) - Number(bill.discountAmount);

    return {
      payments,
      total_paid: totalPaid,
      remaining_amount: amountAfterDiscount - totalPaid,
      final_amount: amountAfterDiscount,
    };
  }

  async getPaymentById(paymentId: string, ownerId: string) {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, bill: { room: { property: { ownerId } } } },
      include: {
        bill: {
          include: {
            tenant: { select: { fullName: true } },
            room: { select: { roomNumber: true } },
          },
        },
      },
    });
    if (!payment) throw new AppError('Data pembayaran tidak ditemukan', 404, 'PAYMENT_NOT_FOUND');
    return payment;
  }
}

export const paymentsService = new PaymentsService();
