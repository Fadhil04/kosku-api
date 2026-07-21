export interface LateFeeCalculationInput {
  totalAmount: number;
  dueDate: Date;
  lateFeePercentage: number;
  lateFeeMaxPercentage: number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'WAIVED';
  referenceDate?: Date; // untuk testing, default ke sekarang
}

export interface LateFeeCalculationResult {
  daysOverdue: number;
  lateFeePercentageApplied: number;
  lateFeeAmount: number;
  finalAmount: number;
  isOverdue: boolean;
}

/**
 * Menghitung late fee secara dinamis berdasarkan due date dan status bill.
 * Late fee TIDAK dihitung untuk bill yang sudah PAID atau WAIVED —
 * nilai final mereka sudah final dan tidak berubah lagi.
 */
export function calculateLateFee(
  input: LateFeeCalculationInput,
): LateFeeCalculationResult {
  const referenceDate = input.referenceDate || new Date();

  // Bill yang sudah lunas atau di-waive tidak pernah dikenakan late fee,
  // berapapun terlambatnya, karena nilainya sudah final
  if (input.status === 'PAID' || input.status === 'WAIVED') {
    return {
      daysOverdue: 0,
      lateFeePercentageApplied: 0,
      lateFeeAmount: 0,
      finalAmount: input.totalAmount,
      isOverdue: false,
    };
  }

  // Normalisasi tanggal ke awal hari supaya perbandingan akurat
  // tanpa terpengaruh jam/menit/detik
  const dueDateOnly = new Date(
    input.dueDate.getFullYear(),
    input.dueDate.getMonth(),
    input.dueDate.getDate(),
  );
  const referenceDateOnly = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );

  const diffMs = referenceDateOnly.getTime() - dueDateOnly.getTime();
  const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (daysOverdue === 0) {
    return {
      daysOverdue: 0,
      lateFeePercentageApplied: 0,
      lateFeeAmount: 0,
      finalAmount: input.totalAmount,
      isOverdue: false,
    };
  }

  // Late fee bertambah tiap hari, tapi dibatasi maksimal
  const rawPercentage = daysOverdue * input.lateFeePercentage;
  const appliedPercentage = Math.min(rawPercentage, input.lateFeeMaxPercentage);

  const lateFeeAmount = Math.round(input.totalAmount * (appliedPercentage / 100));
  const finalAmount = input.totalAmount + lateFeeAmount;

  return {
    daysOverdue,
    lateFeePercentageApplied: appliedPercentage,
    lateFeeAmount,
    finalAmount,
    isOverdue: true,
  };
}