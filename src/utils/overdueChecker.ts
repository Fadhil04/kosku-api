/**
 * Menghitung informasi keterlambatan tagihan.
 * Tidak ada denda — hanya informasi berapa hari sudah melewati due date.
 * Keputusan lanjut-tidaknya sewa ada di tangan owner.
 */

export interface OverdueInfo {
  daysOverdue: number;
  isOverdue: boolean;
  finalAmount: number; // = totalAmount (tidak berubah karena tidak ada denda)
}

export function checkOverdue(params: {
  totalAmount: number;          // sudah setelah diskon
  dueDate: Date;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'WAIVED';
  referenceDate?: Date;
}): OverdueInfo {
  const { totalAmount, dueDate, status, referenceDate } = params;
  const now = referenceDate ?? new Date();

  // Bill lunas/waived — tidak perlu cek
  if (status === 'PAID' || status === 'WAIVED') {
    return { daysOverdue: 0, isOverdue: false, finalAmount: totalAmount };
  }

  const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = nowOnly.getTime() - dueDateOnly.getTime();
  const daysOverdue = Math.max(0, Math.floor(diffMs / 86400000));

  return {
    daysOverdue,
    isOverdue: daysOverdue > 0,
    finalAmount: totalAmount, // tetap sama, tidak ada denda
  };
}
