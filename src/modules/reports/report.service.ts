import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { propertiesService } from '../properties/properties.service';
import type {
  RevenueReportInput,
  OccupancyReportInput,
  PaymentBehaviorInput,
  ComplaintsSummaryInput,
  ExpiringContractsReportInput,
} from './reports.schema';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export class ReportsService {

  // ────────────────────────────────────────────────
  // REVENUE REPORT
  // ────────────────────────────────────────────────
  async getRevenueReport(ownerId: string, input: RevenueReportInput) {
    await propertiesService.verifyPropertyOwnership(input.property_id, ownerId);

    // Agregat tagihan bulan ini
    const [billsSummary, paidBillsSummary] = await Promise.all([
      prisma.bill.aggregate({
        where: {
          propertyId: input.property_id,
          periodMonth: input.month,
          periodYear: input.year,
        },
        _sum: { totalAmount: true, discountAmount: true },
        _count: { id: true },
      }),
      prisma.bill.aggregate({
        where: {
          propertyId: input.property_id,
          periodMonth: input.month,
          periodYear: input.year,
          status: 'PAID',
        },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
    ]);

    // Breakdown per kamar
    const billsPerRoom = await prisma.bill.findMany({
      where: {
        propertyId: input.property_id,
        periodMonth: input.month,
        periodYear: input.year,
      },
      include: {
        tenant: { select: { fullName: true } },
        room: { select: { roomNumber: true } },
        payments: { select: { amount: true } },
      },
      orderBy: { room: { roomNumber: 'asc' } },
    });

    const breakdownPerRoom = billsPerRoom.map((bill) => {
      const totalPaid = bill.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      return {
        room_number: bill.room.roomNumber,
        tenant_name: bill.tenant.fullName,
        billed: Number(bill.totalAmount),
        discount: Number(bill.discountAmount),
        paid: totalPaid,
        status: bill.status,
        due_date: bill.dueDate,
      };
    });

    // Tren 6 bulan terakhir
    const trend = await this.getRevenueTrend(input.property_id, input.month, input.year);

    const totalBilled = Number(billsSummary._sum.totalAmount || 0);
    const totalDiscount = Number(billsSummary._sum.discountAmount || 0);
    const totalBilledAfterDiscount = totalBilled - totalDiscount;
    const totalCollected = Number(paidBillsSummary._sum.totalAmount || 0);

    return {
      period: `${MONTH_NAMES[input.month - 1]} ${input.year}`,
      property_id: input.property_id,
      summary: {
        total_bills: billsSummary._count.id,
        total_billed: totalBilled,
        total_discount: totalDiscount,
        total_billed_after_discount: totalBilledAfterDiscount,
        total_collected: totalCollected,
        outstanding: totalBilledAfterDiscount - totalCollected,
        collection_rate:
          totalBilledAfterDiscount > 0
            ? Math.round((totalCollected / totalBilledAfterDiscount) * 100 * 10) / 10
            : 0,
        paid_count: paidBillsSummary._count.id,
        unpaid_count: billsSummary._count.id - paidBillsSummary._count.id,
      },
      breakdown_per_room: breakdownPerRoom,
      trend,
    };
  }

  // ────────────────────────────────────────────────
  // HELPER: Tren revenue 6 bulan terakhir
  // ────────────────────────────────────────────────
  private async getRevenueTrend(
    propertyId: string,
    currentMonth: number,
    currentYear: number,
  ) {
    const months: { month: number; year: number; label: string }[] = [];

    for (let i = 5; i >= 0; i--) {
      let month = currentMonth - i;
      let year = currentYear;
      if (month <= 0) {
        month += 12;
        year -= 1;
      }
      months.push({ month, year, label: `${MONTH_NAMES[month - 1]} ${year}` });
    }

    const trendData = await Promise.all(
      months.map(async ({ month, year, label }) => {
        const [billed, collected] = await Promise.all([
          prisma.bill.aggregate({
            where: { propertyId, periodMonth: month, periodYear: year },
            _sum: { totalAmount: true },
          }),
          prisma.bill.aggregate({
            where: {
              propertyId,
              periodMonth: month,
              periodYear: year,
              status: 'PAID',
            },
            _sum: { totalAmount: true },
          }),
        ]);

        return {
          label,
          month,
          year,
          billed: Number(billed._sum.totalAmount || 0),
          collected: Number(collected._sum.totalAmount || 0),
        };
      }),
    );

    return trendData;
  }

  // ────────────────────────────────────────────────
  // OCCUPANCY REPORT
  // ────────────────────────────────────────────────
  async getOccupancyReport(ownerId: string, input: OccupancyReportInput) {
    await propertiesService.verifyPropertyOwnership(input.property_id, ownerId);

    const totalRooms = await prisma.room.count({
      where: { propertyId: input.property_id, deletedAt: null },
    });

    if (totalRooms === 0) {
      throw new AppError(
        'Properti ini belum memiliki kamar',
        404,
        'PROPERTY_NO_ROOMS',
      );
    }

    // Hitung occupancy per bulan dalam satu tahun
    const occupancyPerMonth = await Promise.all(
      Array.from({ length: 12 }, (_, i) => i + 1).map(async (month) => {
        const firstDay = new Date(input.year, month - 1, 1);
        const lastDay = new Date(input.year, month, 0);

        // Kamar yang punya kontrak aktif di bulan ini
        const occupiedCount = await prisma.contract.count({
          where: {
            room: { propertyId: input.property_id, deletedAt: null },
            status: { in: ['ACTIVE', 'TERMINATED', 'EXPIRED'] },
            startDate: { lte: lastDay },
            endDate: { gte: firstDay },
          },
        });

        const rate =
          totalRooms > 0
            ? Math.round((occupiedCount / totalRooms) * 100 * 10) / 10
            : 0;

        return {
          month,
          label: MONTH_NAMES[month - 1],
          year: input.year,
          occupied: occupiedCount,
          vacant: totalRooms - occupiedCount,
          total: totalRooms,
          occupancy_rate: rate,
        };
      }),
    );

    // Status kamar saat ini
    const currentStatusCounts = await prisma.room.groupBy({
      by: ['status'],
      where: { propertyId: input.property_id, deletedAt: null },
      _count: { status: true },
    });

    const statusMap: Record<string, number> = {};
    currentStatusCounts.forEach((s) => {
      statusMap[s.status] = s._count.status;
    });

    // Kamar yang paling sering kosong (punya sedikit kontrak)
    const roomsWithContractCount = await prisma.room.findMany({
      where: { propertyId: input.property_id, deletedAt: null },
      select: {
        roomNumber: true,
        type: true,
        basePrice: true,
        status: true,
        _count: { select: { contracts: true } },
      },
      orderBy: { contracts: { _count: 'asc' } },
      take: 5,
    });

    const averageOccupancyRate =
      occupancyPerMonth.reduce((sum, m) => sum + m.occupancy_rate, 0) / 12;

    return {
      year: input.year,
      total_rooms: totalRooms,
      current_status: statusMap,
      average_occupancy_rate: Math.round(averageOccupancyRate * 10) / 10,
      occupancy_per_month: occupancyPerMonth,
      rooms_least_occupied: roomsWithContractCount.map((r) => ({
        room_number: r.roomNumber,
        type: r.type,
        base_price: Number(r.basePrice),
        current_status: r.status,
        total_contracts: r._count.contracts,
      })),
    };
  }

  // ────────────────────────────────────────────────
  // PAYMENT BEHAVIOR REPORT
  // ────────────────────────────────────────────────
  async getPaymentBehaviorReport(ownerId: string, input: PaymentBehaviorInput) {
    await propertiesService.verifyPropertyOwnership(input.property_id, ownerId);

    const now = new Date();
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - input.months + 1,
      1,
    );

    // Ambil semua bill dalam periode ini beserta payment-nya
    const bills = await prisma.bill.findMany({
      where: {
        propertyId: input.property_id,
        dueDate: { gte: startDate },
      },
      include: {
        tenant: { select: { id: true, fullName: true } },
        payments: { orderBy: { paymentDate: 'asc' }, take: 1 },
      },
    });

    // Hitung rata-rata keterlambatan per tenant
    const tenantMap: Record
      string,
      {
        tenantId: string;
        tenantName: string;
        totalBills: number;
        paidOnTime: number;
        paidLate: number;
        totalDaysLate: number;
        unpaid: number;
      }
    > = {};

    for (const bill of bills) {
      const { id: tenantId, fullName: tenantName } = bill.tenant;

      if (!tenantMap[tenantId]) {
        tenantMap[tenantId] = {
          tenantId,
          tenantName,
          totalBills: 0,
          paidOnTime: 0,
          paidLate: 0,
          totalDaysLate: 0,
          unpaid: 0,
        };
      }

      tenantMap[tenantId].totalBills += 1;

      if (bill.status === 'UNPAID' || bill.status === 'PARTIALLY_PAID') {
        tenantMap[tenantId].unpaid += 1;
      } else if (bill.status === 'PAID' && bill.paidAt) {
        const daysLate = Math.max(
          0,
          Math.floor(
            (bill.paidAt.getTime() - bill.dueDate.getTime()) / (1000 * 60 * 60 * 24),
          ),
        );

        if (daysLate === 0) {
          tenantMap[tenantId].paidOnTime += 1;
        } else {
          tenantMap[tenantId].paidLate += 1;
          tenantMap[tenantId].totalDaysLate += daysLate;
        }
      }
    }

    const tenantStats = Object.values(tenantMap).map((t) => ({
      tenant_id: t.tenantId,
      tenant_name: t.tenantName,
      total_bills: t.totalBills,
      paid_on_time: t.paidOnTime,
      paid_late: t.paidLate,
      unpaid: t.unpaid,
      average_days_late:
        t.paidLate > 0
          ? Math.round((t.totalDaysLate / t.paidLate) * 10) / 10
          : 0,
      payment_score: this.calculatePaymentScore(t),
    }));

    // Sort: tenant terbaik duluan
    tenantStats.sort((a, b) => b.payment_score - a.payment_score);

    const summary = {
      period_months: input.months,
      total_bills: bills.length,
      total_paid_on_time: tenantStats.reduce((s, t) => s + t.paid_on_time, 0),
      total_paid_late: tenantStats.reduce((s, t) => s + t.paid_late, 0),
      total_unpaid: tenantStats.reduce((s, t) => s + t.unpaid, 0),
    };

    return {
      summary,
      tenant_stats: tenantStats,
      best_payers: tenantStats.slice(0, 3),
      needs_attention: tenantStats
        .filter((t) => t.average_days_late > 5 || t.unpaid > 0)
        .slice(0, 5),
    };
  }

  // ────────────────────────────────────────────────
  // HELPER: Hitung payment score 0-100
  // ────────────────────────────────────────────────
  private calculatePaymentScore(data: {
    totalBills: number;
    paidOnTime: number;
    paidLate: number;
    totalDaysLate: number;
    unpaid: number;
  }): number {
    if (data.totalBills === 0) return 100;

    const settledBills = data.paidOnTime + data.paidLate;
    const settledRate = settledBills / data.totalBills;
    const onTimeRate = settledBills > 0 ? data.paidOnTime / settledBills : 0;
    const avgDaysLate =
      data.paidLate > 0 ? data.totalDaysLate / data.paidLate : 0;

    // Formula: 60% dari settled rate + 30% dari on-time rate + 10% dari hari keterlambatan
    const latePenalty = Math.min(avgDaysLate / 30, 1); // max penalty kalau rata-rata terlambat 30 hari
    const score =
      settledRate * 60 + onTimeRate * 30 + (1 - latePenalty) * 10;

    return Math.round(score);
  }

  // ────────────────────────────────────────────────
  // COMPLAINTS SUMMARY REPORT
  // ────────────────────────────────────────────────
  async getComplaintsSummaryReport(
    ownerId: string,
    input: ComplaintsSummaryInput,
  ) {
    await propertiesService.verifyPropertyOwnership(input.property_id, ownerId);

    const now = new Date();
    const filterMonth = input.month || now.getMonth() + 1;
    const filterYear = input.year || now.getFullYear();

    const startDate = new Date(filterYear, filterMonth - 1, 1);
    const endDate = new Date(filterYear, filterMonth, 0, 23, 59, 59);

    const where = {
      propertyId: input.property_id,
      createdAt: { gte: startDate, lte: endDate },
    };

    const [byStatus, byCategory, byPriority, avgResolutionTime] =
      await Promise.all([
        // Count per status
        prisma.complaint.groupBy({
          by: ['status'],
          where,
          _count: { status: true },
        }),

        // Count per kategori
        prisma.complaint.groupBy({
          by: ['category'],
          where,
          _count: { category: true },
        }),

        // Count per prioritas
        prisma.complaint.groupBy({
          by: ['priority'],
          where,
          _count: { priority: true },
        }),

        // Rata-rata waktu resolusi (dalam jam) untuk yang sudah RESOLVED/CLOSED
        prisma.complaint.findMany({
          where: {
            ...where,
            status: { in: ['RESOLVED', 'CLOSED'] },
            resolvedAt: { not: null },
          },
          select: { createdAt: true, resolvedAt: true },
        }),
      ]);

    // Hitung rata-rata waktu resolusi
    const resolutionHours = avgResolutionTime
      .filter((c) => c.resolvedAt !== null)
      .map((c) => {
        const diffMs = c.resolvedAt!.getTime() - c.createdAt.getTime();
        return diffMs / (1000 * 60 * 60);
      });

    const avgResolutionHours =
      resolutionHours.length > 0
        ? Math.round(
            (resolutionHours.reduce((sum, h) => sum + h, 0) /
              resolutionHours.length) *
              10,
          ) / 10
        : null;

    // Komplain yang masih OPEN lebih dari 3 hari (perlu perhatian)
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const staleComplaints = await prisma.complaint.findMany({
      where: {
        propertyId: input.property_id,
        status: 'OPEN',
        createdAt: { lte: threeDaysAgo },
      },
      include: {
        tenant: { select: { fullName: true } },
        room: { select: { roomNumber: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      period: `${MONTH_NAMES[filterMonth - 1]} ${filterYear}`,
      by_status: byStatus.map((s) => ({
        status: s.status,
        count: s._count.status,
      })),
      by_category: byCategory.map((c) => ({
        category: c.category,
        count: c._count.category,
      })),
      by_priority: byPriority.map((p) => ({
        priority: p.priority,
        count: p._count.priority,
      })),
      avg_resolution_hours: avgResolutionHours,
      stale_open_complaints: staleComplaints.map((c) => ({
        id: c.id,
        title: c.title,
        tenant_name: c.tenant.fullName,
        room_number: c.room.roomNumber,
        created_at: c.createdAt,
        days_open: Math.floor(
          (now.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24),
        ),
      })),
    };
  }

  // ────────────────────────────────────────────────
  // EXPIRING CONTRACTS REPORT
  // ────────────────────────────────────────────────
  async getExpiringContractsReport(
    ownerId: string,
    input: ExpiringContractsReportInput,
  ) {
    const now = new Date();
    const futureDate = new Date(now.getTime() + input.days * 24 * 60 * 60 * 1000);

    const contracts = await prisma.contract.findMany({
      where: {
        ownerId,
        status: 'ACTIVE',
        endDate: { gte: now, lte: futureDate },
        ...(input.property_id && { room: { propertyId: input.property_id } }),
      },
      orderBy: { endDate: 'asc' },
      include: {
        tenant: { select: { fullName: true, email: true, phoneNumber: true } },
        room: {
          select: {
            roomNumber: true,
            basePrice: true,
            property: { select: { name: true } },
          },
        },
      },
    });

    const withMeta = contracts.map((contract) => {
      const daysRemaining = Math.ceil(
        (contract.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        contract_id: contract.id,
        days_remaining: daysRemaining,
        end_date: contract.endDate,
        tenant: {
          name: contract.tenant.fullName,
          email: contract.tenant.email,
          phone: contract.tenant.phoneNumber,
        },
        room: {
          number: contract.room.roomNumber,
          property: contract.room.property.name,
          base_price: Number(contract.room.basePrice),
        },
        monthly_rent: Number(contract.monthlyRent),
      };
    });

    return {
      period_days: input.days,
      total_expiring: contracts.length,
      contracts: withMeta,
    };
  }

  // ────────────────────────────────────────────────
  // DASHBOARD SUMMARY (gabungan ringkas semua laporan)
  // ────────────────────────────────────────────────
  async getDashboardSummary(ownerId: string) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Ambil semua properti milik owner ini
    const properties = await prisma.property.findMany({
      where: { ownerId, deletedAt: null, isActive: true },
      select: { id: true, name: true },
    });

    if (properties.length === 0) {
      return {
        total_properties: 0,
        total_rooms: 0,
        overall_occupancy_rate: 0,
        current_month_revenue: 0,
        current_month_collection_rate: 0,
        total_active_contracts: 0,
        open_complaints: 0,
        overdue_bills: 0,
        contracts_expiring_30_days: 0,
      };
    }

    const propertyIds = properties.map((p) => p.id);

    const [
      roomStats,
      currentMonthBilled,
      currentMonthCollected,
      activeContracts,
      openComplaints,
      overdueBills,
      expiringContracts,
    ] = await Promise.all([
      // Status kamar keseluruhan
      prisma.room.groupBy({
        by: ['status'],
        where: { propertyId: { in: propertyIds }, deletedAt: null },
        _count: { status: true },
      }),

      // Tagihan bulan ini
      prisma.bill.aggregate({
        where: {
          propertyId: { in: propertyIds },
          periodMonth: currentMonth,
          periodYear: currentYear,
        },
        _sum: { totalAmount: true },
      }),

      // Yang sudah terbayar bulan ini
      prisma.bill.aggregate({
        where: {
          propertyId: { in: propertyIds },
          periodMonth: currentMonth,
          periodYear: currentYear,
          status: 'PAID',
        },
        _sum: { totalAmount: true },
      }),

      // Kontrak aktif
      prisma.contract.count({
        where: { ownerId, status: 'ACTIVE' },
      }),

      // Komplain yang masih OPEN
      prisma.complaint.count({
        where: { propertyId: { in: propertyIds }, status: 'OPEN' },
      }),

      // Bill yang overdue
      prisma.bill.count({
        where: {
          propertyId: { in: propertyIds },
          status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
          dueDate: { lt: now },
        },
      }),

      // Kontrak yang expire dalam 30 hari
      prisma.contract.count({
        where: {
          ownerId,
          status: 'ACTIVE',
          endDate: {
            gte: now,
            lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    let totalRooms = 0;
    roomStats.forEach((s) => {
      statusMap[s.status] = s._count.status;
      totalRooms += s._count.status;
    });

    const occupiedRooms = statusMap['OCCUPIED'] || 0;
    const occupancyRate =
      totalRooms > 0
        ? Math.round((occupiedRooms / totalRooms) * 100 * 10) / 10
        : 0;

    const totalBilled = Number(currentMonthBilled._sum.totalAmount || 0);
    const totalCollected = Number(currentMonthCollected._sum.totalAmount || 0);
    const collectionRate =
      totalBilled > 0
        ? Math.round((totalCollected / totalBilled) * 100 * 10) / 10
        : 0;

    return {
      total_properties: properties.length,
      total_rooms: totalRooms,
      room_status: statusMap,
      overall_occupancy_rate: occupancyRate,
      current_month_revenue: {
        billed: totalBilled,
        collected: totalCollected,
        collection_rate: collectionRate,
      },
      total_active_contracts: activeContracts,
      open_complaints: openComplaints,
      overdue_bills: overdueBills,
      contracts_expiring_30_days: expiringContracts,
    };
  }
}

export const reportsService = new ReportsService();