import { prisma } from '../../config/database';
import { generateSingleBill } from '../../utils/billGenerator';

export async function processMonthlyBillGeneration() {
  const now = new Date();
  // Generate untuk bulan depan
  const nextMonth = now.getMonth() + 2; // +1 untuk 1-indexed, +1 lagi untuk bulan depan
  const targetMonth = nextMonth > 12 ? nextMonth - 12 : nextMonth;
  const targetYear = nextMonth > 12 ? now.getFullYear() + 1 : now.getFullYear();

  // Ambil semua kontrak aktif yang masih berjalan di bulan target
  const activeContracts = await prisma.contract.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { gte: new Date(targetYear, targetMonth - 1, 1) },
    },
    include: { room: { select: { propertyId: true } } },
  });

  let generated = 0;
  let skipped = 0;

  for (const contract of activeContracts) {
    // Cek apakah bill untuk bulan ini sudah ada (hindari duplikasi)
    const existingBill = await prisma.bill.findUnique({
      where: {
        contractId_periodMonth_periodYear: {
          contractId: contract.id,
          periodMonth: targetMonth,
          periodYear: targetYear,
        },
      },
    });

    if (existingBill) {
      skipped += 1;
      continue;
    }

    const additionalCharges = contract.additionalCharges as unknown as Array<{
      name: string;
      amount: number;
    }>;

    const newBill = generateSingleBill({
      contractId: contract.id,
      tenantId: contract.tenantId,
      roomId: contract.roomId,
      propertyId: contract.room.propertyId,
      month: targetMonth,
      year: targetYear,
      billingDate: contract.billingDate,
      monthlyRent: Number(contract.monthlyRent),
      additionalCharges,
    });

    await prisma.bill.create({
      data: {
        ...newBill,
        additionalCharges: newBill.additionalCharges as unknown as object,
      },
    });

    generated += 1;
  }

  console.log(
    `Monthly bill generation selesai: ${generated} dibuat, ${skipped} dilewati (sudah ada)`,
  );

  return { generated, skipped, targetMonth, targetYear };
}