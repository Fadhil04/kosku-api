import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { getPagination, getPaginationMeta } from '../../utils/pagination';
import type {
  CreatePropertyInput,
  UpdatePropertyInput,
  PropertyQueryInput,
} from './properties.schema';

export class PropertiesService {

  // ────────────────────────────────────────────────
  // CREATE PROPERTY
  // ────────────────────────────────────────────────
  async createProperty(ownerId: string, input: CreatePropertyInput) {
    const property = await prisma.property.create({
      data: {
        ownerId,
        name: input.name,
        address: input.address,
        city: input.city,
        province: input.province,
        postalCode: input.postal_code,
        description: input.description,
        rules: input.rules,
        facilities: input.facilities,
        photos: input.photos,
      },
    });

    return property;
  }

  // ────────────────────────────────────────────────
  // GET ALL PROPERTIES (milik owner yang login)
  // ────────────────────────────────────────────────
  async getProperties(ownerId: string, query: PropertyQueryInput) {
    const { skip, take, page, limit } = getPagination(query);

    const where = {
      ownerId,
      deletedAt: null,
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' as const } },
          { city: { contains: query.search, mode: 'insensitive' as const } },
          { address: { contains: query.search, mode: 'insensitive' as const } },
        ],
      }),
      ...(query.city && {
        city: { contains: query.city, mode: 'insensitive' as const },
      }),
      ...(query.is_active !== undefined && { isActive: query.is_active }),
    };

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { rooms: true },
          },
        },
      }),
      prisma.property.count({ where }),
    ]);

    // Ambil statistik ringkas untuk tiap properti
    const propertiesWithStats = await Promise.all(
      properties.map(async (property) => {
        const stats = await this.getPropertyQuickStats(property.id);
        return {
          ...property,
          _count: undefined,
          total_rooms: property._count.rooms,
          stats,
        };
      }),
    );

    return {
      data: propertiesWithStats,
      meta: getPaginationMeta(total, page, limit),
    };
  }

  // ────────────────────────────────────────────────
  // GET PROPERTY DETAIL
  // ────────────────────────────────────────────────
  async getPropertyById(propertyId: string, ownerId: string) {
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        ownerId,
        deletedAt: null,
      },
      include: {
        rooms: {
          where: { deletedAt: null },
          orderBy: { roomNumber: 'asc' },
          select: {
            id: true,
            roomNumber: true,
            floor: true,
            type: true,
            basePrice: true,
            status: true,
            facilities: true,
          },
        },
      },
    });

    if (!property) {
      throw new AppError('Properti tidak ditemukan', 404, 'PROPERTY_NOT_FOUND');
    }

    const stats = await this.getPropertyDetailStats(propertyId);

    return { ...property, stats };
  }

  // ────────────────────────────────────────────────
  // UPDATE PROPERTY
  // ────────────────────────────────────────────────
  async updateProperty(
    propertyId: string,
    ownerId: string,
    input: UpdatePropertyInput,
  ) {
    await this.verifyPropertyOwnership(propertyId, ownerId);

    const updated = await prisma.property.update({
      where: { id: propertyId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.address && { address: input.address }),
        ...(input.city && { city: input.city }),
        ...(input.province && { province: input.province }),
        ...(input.postal_code !== undefined && { postalCode: input.postal_code }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.rules !== undefined && { rules: input.rules }),
        ...(input.facilities && { facilities: input.facilities }),
        ...(input.photos && { photos: input.photos }),
      },
    });

    return updated;
  }

  // ────────────────────────────────────────────────
  // DELETE PROPERTY (soft delete)
  // ────────────────────────────────────────────────
  async deleteProperty(propertyId: string, ownerId: string) {
    await this.verifyPropertyOwnership(propertyId, ownerId);

    // Cek apakah ada kontrak aktif
    const activeContracts = await prisma.contract.count({
      where: {
        room: { propertyId },
        status: 'ACTIVE',
      },
    });

    if (activeContracts > 0) {
      throw new AppError(
        `Tidak bisa menghapus properti yang masih memiliki ${activeContracts} kontrak aktif`,
        409,
        'PROPERTY_HAS_ACTIVE_CONTRACTS',
      );
    }

    await prisma.property.update({
      where: { id: propertyId },
      data: { deletedAt: new Date(), isActive: false },
    });

    return { message: 'Properti berhasil dihapus' };
  }

  // ────────────────────────────────────────────────
  // HELPER: Statistik ringkas untuk list
  // ────────────────────────────────────────────────
  private async getPropertyQuickStats(propertyId: string) {
    const [roomStats, unpaidBills] = await Promise.all([
      prisma.room.groupBy({
        by: ['status'],
        where: { propertyId, deletedAt: null },
        _count: { status: true },
      }),
      prisma.bill.aggregate({
        where: {
          propertyId,
          status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
        },
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    roomStats.forEach((r) => {
      statusMap[r.status] = r._count.status;
    });

    const totalRooms = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const occupiedRooms = statusMap['OCCUPIED'] || 0;
    const availableRooms = statusMap['AVAILABLE'] || 0;
    const maintenanceRooms = statusMap['NEEDS_MAINTENANCE'] || 0;
    const reservedRooms = statusMap['RESERVED'] || 0;

    return {
      total_rooms: totalRooms,
      occupied_rooms: occupiedRooms,
      available_rooms: availableRooms,
      reserved_rooms: reservedRooms,
      maintenance_rooms: maintenanceRooms,
      occupancy_rate:
        totalRooms > 0
          ? Math.round((occupiedRooms / totalRooms) * 100 * 10) / 10
          : 0,
      unpaid_bills_count: unpaidBills._count.id,
      unpaid_bills_total: Number(unpaidBills._sum.totalAmount || 0),
    };
  }

  // ────────────────────────────────────────────────
  // HELPER: Statistik lengkap untuk detail
  // ────────────────────────────────────────────────
  private async getPropertyDetailStats(propertyId: string) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const [quickStats, currentMonthBills, contractsExpiringSoon] =
      await Promise.all([
        this.getPropertyQuickStats(propertyId),

        // Tagihan bulan ini
        prisma.bill.aggregate({
          where: {
            propertyId,
            periodMonth: currentMonth,
            periodYear: currentYear,
          },
          _sum: { totalAmount: true },
          _count: { id: true },
        }),

        // Kontrak yang akan berakhir dalam 30 hari
        prisma.contract.count({
          where: {
            room: { propertyId },
            status: 'ACTIVE',
            endDate: {
              lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
              gte: now,
            },
          },
        }),
      ]);

    // Tagihan bulan ini yang sudah dibayar
    const paidBills = await prisma.bill.aggregate({
      where: {
        propertyId,
        periodMonth: currentMonth,
        periodYear: currentYear,
        status: 'PAID',
      },
      _sum: { totalAmount: true },
    });

    const totalBilled = Number(currentMonthBills._sum.totalAmount || 0);
    const totalCollected = Number(paidBills._sum.totalAmount || 0);

    return {
      ...quickStats,
      current_month_billed: totalBilled,
      current_month_collected: totalCollected,
      collection_rate:
        totalBilled > 0
          ? Math.round((totalCollected / totalBilled) * 100 * 10) / 10
          : 0,
      contracts_expiring_30_days: contractsExpiringSoon,
    };
  }

  // ────────────────────────────────────────────────
  // HELPER: Verifikasi ownership
  // ────────────────────────────────────────────────
  async verifyPropertyOwnership(propertyId: string, ownerId: string) {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, ownerId, deletedAt: null },
    });

    if (!property) {
      throw new AppError(
        'Properti tidak ditemukan atau kamu tidak memiliki akses',
        404,
        'PROPERTY_NOT_FOUND',
      );
    }

    return property;
  }
}

export const propertiesService = new PropertiesService();