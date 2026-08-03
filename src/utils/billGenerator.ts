/**
 * Generator tagihan bulanan.
 * Tidak ada late fee — sistem hanya mencatat due date.
 * Denda/tindakan atas keterlambatan adalah keputusan owner.
 */

export interface AdditionalCharge {
  name: string;
  amount: number;
}

export interface GenerateBillsParams {
  contractId: string;
  tenantId: string;
  roomId: string;
  propertyId: string;
  startDate: Date;
  endDate: Date;
  billingDate: number;
  monthlyRent: number;
  additionalCharges: AdditionalCharge[];
}

export interface BillToCreate {
  contractId: string;
  tenantId: string;
  roomId: string;
  propertyId: string;
  periodMonth: number;
  periodYear: number;
  dueDate: Date;
  baseRent: number;
  additionalCharges: AdditionalCharge[];
  totalAmount: number;
  status: 'UNPAID';
}

/**
 * Generate daftar bill untuk seluruh periode kontrak.
 *
 * Contoh: kontrak 1 Juli 2025 - 30 Juni 2026, billingDate 5
 * → 12 bill, masing-masing due date tanggal 5 tiap bulan.
 *
 * Edge case: jika billingDate sudah lewat di bulan startDate,
 * due date bulan pertama tetap di bulan itu (bukan bulan berikutnya)
 * karena owner yang menentukan apakah tagihan pertama diprorate.
 */
export function generateBillsForContract(params: GenerateBillsParams): BillToCreate[] {
  const {
    contractId, tenantId, roomId, propertyId,
    startDate, endDate, billingDate, monthlyRent, additionalCharges,
  } = params;

  const bills: BillToCreate[] = [];
  const additionalTotal = additionalCharges.reduce((s, c) => s + c.amount, 0);
  const totalAmount = monthlyRent + additionalTotal;

  let currentMonth = startDate.getMonth() + 1;
  let currentYear = startDate.getFullYear();
  const endMonth = endDate.getMonth() + 1;
  const endYear = endDate.getFullYear();

  while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
    // Due date = tanggal billingDate di bulan ini
    // Jika billingDate lebih kecil dari tanggal mulai kontrak di bulan pertama,
    // geser ke bulan berikutnya agar tidak mundur ke sebelum kontrak dimulai
    let dueYear = currentYear;
    let dueMonth = currentMonth;
    const isFirstMonth = currentYear === startDate.getFullYear() && currentMonth === (startDate.getMonth() + 1);
    if (isFirstMonth && billingDate < startDate.getDate()) {
      // Due date bulan pertama = bulan berikutnya
      dueMonth += 1;
      if (dueMonth > 12) { dueMonth = 1; dueYear += 1; }
    }
    const dueDate = new Date(dueYear, dueMonth - 1, billingDate);

    bills.push({
      contractId,
      tenantId,
      roomId,
      propertyId,
      periodMonth: currentMonth,
      periodYear: currentYear,
      dueDate,
      baseRent: monthlyRent,
      additionalCharges,
      totalAmount,
      status: 'UNPAID',
    });

    currentMonth += 1;
    if (currentMonth > 12) { currentMonth = 1; currentYear += 1; }
  }

  return bills;
}

/** Generate satu bill tambahan (untuk perpanjangan kontrak) */
export function generateSingleBill(params: {
  contractId: string;
  tenantId: string;
  roomId: string;
  propertyId: string;
  month: number;
  year: number;
  billingDate: number;
  monthlyRent: number;
  additionalCharges: AdditionalCharge[];
}): BillToCreate {
  const additionalTotal = params.additionalCharges.reduce((s, c) => s + c.amount, 0);
  return {
    contractId: params.contractId,
    tenantId: params.tenantId,
    roomId: params.roomId,
    propertyId: params.propertyId,
    periodMonth: params.month,
    periodYear: params.year,
    dueDate: new Date(params.year, params.month - 1, params.billingDate),
    baseRent: params.monthlyRent,
    additionalCharges: params.additionalCharges,
    totalAmount: params.monthlyRent + additionalTotal,
    status: 'UNPAID',
  };
}
