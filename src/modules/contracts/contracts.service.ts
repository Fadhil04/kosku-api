import { prisma } from '../../config/database';
import { sendEmail } from '../../config/email';
import { AppError } from '../../middleware/errorHandler';
import { getPagination, getPaginationMeta } from '../../utils/pagination';
import { generateBillsForContract, generateSingleBill } from '../../utils/billGenerator';
import {
  contractCreatedTenantTemplate,
} from '../../utils/emailTemplates';
import type {
  CreateContractInput,
  TerminateContractInput,
  RenewContractInput,
  ContractQueryInput,
  ExpiringContractQueryInput,
} from './contracts.schema';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export class ContractsService {

  // ────────────────────────────────────────────────
  // CREATE CONTRACT — inti dari kompleksitas sistem ini
  // ────────────────────────────────────────────────
  async createContract(ownerId: string, input: CreateContractInput) {
    // Validasi room: harus milik owner ini dan berstatus AVAILABLE
    const room = await prisma.room.findFirst({
      where: { id: input.room_id, deletedAt: null },
      include: { property: true },
    });

    if (!room) {
      throw new AppError('Kamar tidak ditemukan', 404, 'ROOM_NOT_FOUND');
    }

    if (room.property.ownerId !== ownerId) {
      throw new AppError(
        'Kamu tidak memiliki akses ke kamar ini',
        403,
        'ROOM_ACCESS_DENIED',
      );
    }

    if (room.status !== 'AVAILABLE') {
      throw new AppError(
        `Kamar ${room.roomNumber} sedang tidak tersedia (status: ${room.status})`,
        422,
        'ROOM_NOT_AVAILABLE',
      );
    }

    // Validasi tenant: pastikan tidak punya kontrak aktif lain dengan owner ini
    const tenant = await prisma.tenant.findUnique({
      where: { id: input.tenant_id, deletedAt: null },
    });

    if (!tenant) {
      throw new AppError('Penghuni tidak ditemukan', 404, 'TENANT_NOT_FOUND');
    }

    const existingActiveContract = await prisma.contract.findFirst({
      where: {
        tenantId: input.tenant_id,
        ownerId,
        status: 'ACTIVE',
      },
    });

    if (existingActiveContract) {
      throw new AppError(
        'Penghuni ini masih memiliki kontrak aktif di kamar lain. ' +
          'Akhiri kontrak yang lama terlebih dahulu.',
        409,
        'TENANT_HAS_ACTIVE_CONTRACT',
      );
    }

    // Generate semua bills sebelum masuk transaction
    // (perhitungan murni, tidak perlu di dalam transaction)
    const billsToCreate = generateBillsForContract({
      contractId: '', // akan diisi setelah contract dibuat
      tenantId: input.tenant_id,
      roomId: input.room_id,
      propertyId: room.propertyId,
      startDate: input.start_date,
      endDate: input.end_date,
      billingDate: input.billing_date,
      monthlyRent: input.monthly_rent,
      additionalCharges: input.additional_charges,
    });

    // ──────────────────────────────────────────
    // DATABASE TRANSACTION
    // Semua langkah ini berhasil semua atau gagal semua
    // ──────────────────────────────────────────
    const result = await prisma.$transaction(async (tx) => {
      // 1. Buat record contract
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

      // 2. Ubah status room jadi OCCUPIED
      await tx.room.update({
        where: { id: input.room_id },
        data: { status: 'OCCUPIED' },
      });

      // 3. Generate semua bills dengan contractId yang benar
      const billsWithContractId = billsToCreate.map((bill) => ({
        ...bill,
        contractId: contract.id,
        additionalCharges: bill.additionalCharges as unknown as object,
      }));

      await tx.bill.createMany({
        data: billsWithContractId,
      });

      // 4. Catat audit log
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

    // Email dikirim setelah transaction berhasil commit
    // (di luar transaction karena ini side effect eksternal,
    // jika transaction di-rollback, email tidak perlu dikirim)
    const template = contractCreatedTenantTemplate({
      fullName: tenant.fullName,
      propertyName: room.property.name,
      roomNumber: room.roomNumber,
      startDate: input.start_date.toLocaleDateString('id-ID'),
      endDate: input.end_date.toLocaleDateString('id-ID'),
      monthlyRent: input.monthly_rent.toLocaleString('id-ID'),
    });

    await sendEmail({
      to: tenant.email,
      subject: template.subject,
      html: template.html,
    }).catch((err) => {
      // Email gagal tidak boleh menggagalkan keseluruhan proses
      // karena kontrak sudah berhasil dibuat. Cukup log errornya.
      console.error('Gagal mengirim email konfirmasi kontrak:', err);
    });

    return {
      ...result.contract,
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
      ...(query.property_id && {
        room: { propertyId: query.property_id },
      }),
    };

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: {
            select: { id: true, fullName: true, email: true, phoneNumber: true },
          },
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
      data: contracts,
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
        tenant: true,
        room: {
          include: { property: { select: { id: true, name: true, address: true } } },
        },
        bills: {
          orderBy: [{ periodYear: 'asc' }, { periodMonth: 'asc' }],
          include: {
            payments: {
              select: { id: true, amount: true, paymentDate: true, status: true },
            },
          },
        },
      },
    });

    if (!contract) {
      throw new AppError('Kontrak tidak ditemukan', 404, 'CONTRACT_NOT_FOUND');
    }

    return contract;
  }

  // ────────────────────────────────────────────────
  // GET EXPIRING CONTRACTS
  // ────────────────────────────────────────────────
  async getExpiringContracts(
    ownerId: string,
    query: ExpiringContractQueryInput,
  ) {
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
        tenant: { select: { fullName: true, email: true, phoneNumber: true } },
        room: {
          select: {
            roomNumber: true,
            property: { select: { name: true } },
          },
        },
      },
    });

    const withDaysRemaining = contracts.map((contract) => {
      const daysRemaining = Math.ceil(
        (contract.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      return { ...contract, days_remaining: daysRemaining };
    });

    return withDaysRemaining;
  }

  // ────────────────────────────────────────────────
  // TERMINATE CONTRACT
  // ────────────────────────────────────────────────
  async terminateContract(
    contractId: string,
    ownerId: string,
    input: TerminateContractInput,
  ) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, ownerId },
      include: { room: true, tenant: true },
    });

    if (!contract) {
      throw new AppError('Kontrak tidak ditemukan', 404, 'CONTRACT_NOT_FOUND');
    }

    if (contract.status === 'TERMINATED') {
      throw new AppError(
        'Kontrak ini sudah diterminasi sebelumnya',
        409,
        'CONTRACT_ALREADY_TERMINATED',
      );
    }

    if (contract.status === 'EXPIRED') {
      throw new AppError(
        'Kontrak yang sudah berakhir tidak bisa diterminasi',
        409,
        'CONTRACT_ALREADY_EXPIRED',
      );
    }

    const depositStatus =
      input.deposit_action === 'REFUND_FULL'
        ? 'REFUNDED'
        : input.deposit_action === 'REFUND_PARTIAL'
          ? 'REFUNDED'
          : contract.depositStatus;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update contract jadi TERMINATED
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

      // 2. Ubah status room jadi NEEDS_MAINTENANCE
      await tx.room.update({
        where: { id: contract.roomId },
        data: { status: 'NEEDS_MAINTENANCE' },
      });

      // 3. Cancel bills yang belum jatuh tempo setelah tanggal terminasi
      // (waive, bukan delete, supaya histori tetap ada)
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

      // 4. Audit log
      await tx.auditLog.create({
        data: {
          entityType: 'contract',
          entityId: contractId,
          action: 'TERMINATED',
          oldValues: { status: contract.status },
          newValues: {
            status: 'TERMINATED',
            terminationDate: input.termination_date,
            reason: input.termination_reason,
          },
          performedBy: ownerId,
          performerRole: 'owner',
        },
      });

      return { updatedContract, cancelledBillsCount: cancelledBills.count };
    });

    return {
      ...result.updatedContract,
      cancelled_bills: result.cancelledBillsCount,
    };
  }

  // ────────────────────────────────────────────────
  // RENEW CONTRACT
  // ────────────────────────────────────────────────
  async renewContract(
    contractId: string,
    ownerId: string,
    input: RenewContractInput,
  ) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, ownerId },
    });

    if (!contract) {
      throw new AppError('Kontrak tidak ditemukan', 404, 'CONTRACT_NOT_FOUND');
    }

    if (contract.status !== 'ACTIVE' && contract.status !== 'EXPIRED') {
      throw new AppError(
        'Hanya kontrak aktif atau yang sudah berakhir yang bisa diperpanjang',
        422,
        'CONTRACT_CANNOT_RENEW',
      );
    }

    if (input.new_end_date <= contract.endDate) {
      throw new AppError(
        'Tanggal selesai baru harus lebih lambat dari tanggal selesai saat ini',
        400,
        'INVALID_RENEWAL_DATE',
      );
    }

    const newMonthlyRent = input.new_monthly_rent || Number(contract.monthlyRent);
    const additionalCharges = contract.additionalCharges as unknown as Array<{
      name: string;
      amount: number;
    }>;

    // Generate bills untuk periode tambahan (dari bulan setelah endDate lama sampai endDate baru)
    const additionalBills = generateBillsForContract({
      contractId: contract.id,
      tenantId: contract.tenantId,
      roomId: contract.roomId,
      propertyId: (await prisma.room.findUnique({ where: { id: contract.roomId } }))!.propertyId,
      startDate: new Date(
        contract.endDate.getFullYear(),
        contract.endDate.getMonth() + 1,
        1,
      ),
      endDate: input.new_end_date,
      billingDate: contract.billingDate,
      monthlyRent: newMonthlyRent,
      additionalCharges,
    });

    const result = await prisma.$transaction(async (tx) => {
      const updatedContract = await tx.contract.update({
        where: { id: contractId },
        data: {
          endDate: input.new_end_date,
          monthlyRent: newMonthlyRent,
          status: 'ACTIVE',
        },
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
      ...result.updatedContract,
      new_bills_generated: result.newBillsCount,
    };
  }
}

export const contractsService = new ContractsService();