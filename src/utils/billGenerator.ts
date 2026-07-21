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
 * Contoh: kontrak 1 Juli 2025 - 30 Juni 2026, billingDate 1
 * akan menghasilkan 12 bill, masing-masing untuk bulan Jul 2025 - Jun 2026,
 * dengan due date tanggal 1 tiap bulannya.
 */
export function generateBillsForContract(
  params: GenerateBillsParams,
): BillToCreate[] {
  const {
    contractId,
    tenantId,
    roomId,
    propertyId,
    startDate,
    endDate,
    billingDate,
    monthlyRent,
    additionalCharges,
  } = params;

  const bills: BillToCreate[] = [];

  const additionalTotal = additionalCharges.reduce(
    (sum, charge) => sum + charge.amount,
    0,
  );
  const totalAmount = monthlyRent + additionalTotal;

  // Mulai dari bulan dan tahun startDate
  let currentMonth = startDate.getMonth() + 1; // getMonth() 0-indexed
  let currentYear = startDate.getFullYear();

  const endMonth = endDate.getMonth() + 1;
  const endYear = endDate.getFullYear();

  while (
    currentYear < endYear ||
    (currentYear === endYear && currentMonth <= endMonth)
  ) {
    // Due date: tanggal billingDate di bulan & tahun berjalan
    // Tapi untuk bulan pertama, due date adalah startDate jika billingDate
    // lebih besar dari tanggal mulai kontrak
    const dueDate = new Date(currentYear, currentMonth - 1, billingDate);

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

    // Maju ke bulan berikutnya
    currentMonth += 1;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear += 1;
    }
  }

  return bills;
}

/**
 * Generate satu bill tambahan untuk perpanjangan kontrak
 * (dipakai saat fitur renew kontrak)
 */
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
  const additionalTotal = params.additionalCharges.reduce(
    (sum, charge) => sum + charge.amount,
    0,
  );

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