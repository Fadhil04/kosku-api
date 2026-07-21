import { RoomStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { getPagination, getPaginationMeta } from '../../utils/pagination';
import { ALLOWED_TRANSITIONS } from './rooms.schema';
import { propertiesService } from '../properties/properties.service';
import type {
  CreateRoomInput,
  UpdateRoomInput,
  UpdateRoomStatusInput,
  RoomQueryInput,
} from './rooms.schema';

export class RoomsService {

  // ────────────────────────────────────────────────
  // CREATE ROOM
  // ────────────────────────────────────────────────
  async createRoom(
    propertyId: string,
    ownerId: string,
    input: CreateRoomInput,
  ) {
    // Verifikasi ownership properti
    await propertiesService.verifyPropertyOwnership(propertyId, ownerId);

    // Cek duplikasi nomor kamar dalam properti yang sama
    const existingRoom = await prisma.room.findFirst({
      where: {
        propertyId,
        roomNumber: input.room_number,
        deletedAt: null,
      },
    });

    if (existingRoom) {
      throw new AppError(
        `Nomor kamar ${input.room_number} sudah ada di properti ini`,
        409,
        'ROOM_NUMBER_DUPLICATE',
      );
    }

    const room = await prisma.room.create({
      data: {
        propertyId,
        roomNumber: input.room_number,
        floor: input.floor,
        type: input.type,
        sizeSqm: input.size_sqm,
        basePrice: input.base_price,
        facilities: input.facilities,
        photos: input.photos,
        notes: input.notes,
        status: 'AVAILABLE',
      },
    });

    return room;
  }

  // ────────────────────────────────────────────────
  // GET ALL ROOMS
  // ────────────────────────────────────────────────
  async getRooms(
    propertyId: string,
    ownerId: string,
    query: RoomQueryInput,
  ) {
    await propertiesService.verifyPropertyOwnership(propertyId, ownerId);

    const { skip, take, page, limit } = getPagination(query);

    const where = {
      propertyId,
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(query.floor !== undefined && { floor: query.floor }),
      ...(query.type && {
        type: { contains: query.type, mode: 'insensitive' as const },
      }),
      ...(query.min_price !== undefined && {
        basePrice: { gte: query.min_price },
      }),
      ...(query.max_price !== undefined && {
        basePrice: { lte: query.max_price },
      }),
    };

    const [rooms, total] = await Promise.all([
      prisma.room.findMany({
        where,
        skip,
        take,
        orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
        include: {
          contracts: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              startDate: true,
              endDate: true,
              monthlyRent: true,
              tenant: {
                select: {
                  id: true,
                  fullName: true,
                  phoneNumber: true,
                },
              },
            },
            take: 1,
          },
        },
      }),
      prisma.room.count({ where }),
    ]);

    const roomsFormatted = rooms.map((room) => ({
      ...room,
      active_contract: room.contracts[0] || null,
      contracts: undefined,
    }));

    return {
      data: roomsFormatted,
      meta: getPaginationMeta(total, page, limit),
    };
  }

  // ────────────────────────────────────────────────
  // GET AVAILABLE ROOMS
  // ────────────────────────────────────────────────
  async getAvailableRooms(propertyId: string, ownerId: string) {
    await propertiesService.verifyPropertyOwnership(propertyId, ownerId);

    const rooms = await prisma.room.findMany({
      where: {
        propertyId,
        status: 'AVAILABLE',
        deletedAt: null,
      },
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
    });

    return rooms;
  }

  // ────────────────────────────────────────────────
  // GET ROOM BY ID
  // ────────────────────────────────────────────────
  async getRoomById(
    propertyId: string,
    roomId: string,
    ownerId: string,
  ) {
    await propertiesService.verifyPropertyOwnership(propertyId, ownerId);

    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        propertyId,
        deletedAt: null,
      },
      include: {
        contracts: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            startDate: true,
            endDate: true,
            monthlyRent: true,
            status: true,
            tenant: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      throw new AppError('Kamar tidak ditemukan', 404, 'ROOM_NOT_FOUND');
    }

    // Hitung statistik kamar
    const stats = await this.getRoomStats(roomId);

    return { ...room, stats };
  }

  // ────────────────────────────────────────────────
  // UPDATE ROOM
  // ────────────────────────────────────────────────
  async updateRoom(
    propertyId: string,
    roomId: string,
    ownerId: string,
    input: UpdateRoomInput,
  ) {
    await propertiesService.verifyPropertyOwnership(propertyId, ownerId);
    await this.verifyRoomBelongsToProperty(roomId, propertyId);

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: {
        ...(input.floor !== undefined && { floor: input.floor }),
        ...(input.type && { type: input.type }),
        ...(input.size_sqm !== undefined && { sizeSqm: input.size_sqm }),
        ...(input.base_price !== undefined && { basePrice: input.base_price }),
        ...(input.facilities && { facilities: input.facilities }),
        ...(input.photos && { photos: input.photos }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });

    return updated;
  }

  // ────────────────────────────────────────────────
  // UPDATE ROOM STATUS (state machine)
  // ────────────────────────────────────────────────
  async updateRoomStatus(
    propertyId: string,
    roomId: string,
    ownerId: string,
    input: UpdateRoomStatusInput,
  ) {
    await propertiesService.verifyPropertyOwnership(propertyId, ownerId);

    const room = await this.verifyRoomBelongsToProperty(roomId, propertyId);

    // Cek apakah transisi status diizinkan
    const allowedNextStatuses = ALLOWED_TRANSITIONS[room.status];
    if (!allowedNextStatuses.includes(input.status)) {
      throw new AppError(
        `Tidak bisa mengubah status kamar dari ${room.status} ke ${input.status}. ` +
          `Status yang diizinkan: ${allowedNextStatuses.join(', ')}`,
        422,
        'ROOM_STATUS_TRANSITION_INVALID',
      );
    }

    // Kalau mau set ke AVAILABLE, pastikan tidak ada kontrak aktif
    if (input.status === 'AVAILABLE') {
      const activeContract = await prisma.contract.findFirst({
        where: { roomId, status: 'ACTIVE' },
      });

      if (activeContract) {
        throw new AppError(
          'Tidak bisa mengubah status ke tersedia karena masih ada kontrak aktif',
          409,
          'ROOM_HAS_ACTIVE_CONTRACT',
        );
      }
    }

    const oldStatus = room.status;

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: {
        status: input.status,
        ...(input.notes && { notes: input.notes }),
      },
    });

    // Catat perubahan di audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'room',
        entityId: roomId,
        action: 'STATUS_CHANGED',
        oldValues: { status: oldStatus },
        newValues: { status: input.status, notes: input.notes },
        performedBy: ownerId,
        performerRole: 'owner',
      },
    });

    return updated;
  }

  // ────────────────────────────────────────────────
  // DELETE ROOM (soft delete)
  // ────────────────────────────────────────────────
  async deleteRoom(
    propertyId: string,
    roomId: string,
    ownerId: string,
  ) {
    await propertiesService.verifyPropertyOwnership(propertyId, ownerId);

    const room = await this.verifyRoomBelongsToProperty(roomId, propertyId);

    if (room.status === 'OCCUPIED') {
      throw new AppError(
        'Tidak bisa menghapus kamar yang sedang dihuni',
        409,
        'ROOM_CURRENTLY_OCCUPIED',
      );
    }

    const activeContract = await prisma.contract.findFirst({
      where: { roomId, status: 'ACTIVE' },
    });

    if (activeContract) {
      throw new AppError(
        'Tidak bisa menghapus kamar yang masih memiliki kontrak aktif',
        409,
        'ROOM_HAS_ACTIVE_CONTRACT',
      );
    }

    await prisma.room.update({
      where: { id: roomId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Kamar berhasil dihapus' };
  }

  // ────────────────────────────────────────────────
  // HELPER: Statistik kamar
  // ────────────────────────────────────────────────
  private async getRoomStats(roomId: string) {
    const [totalContracts, totalBilled, totalCollected] = await Promise.all([
      prisma.contract.count({ where: { roomId } }),

      prisma.bill.aggregate({
        where: { roomId },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),

      prisma.bill.aggregate({
        where: { roomId, status: 'PAID' },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      total_contracts: totalContracts,
      total_billed: Number(totalBilled._sum.totalAmount || 0),
      total_collected: Number(totalCollected._sum.totalAmount || 0),
      total_bills: totalBilled._count.id,
    };
  }

  // ────────────────────────────────────────────────
  // HELPER: Verifikasi kamar milik properti
  // ────────────────────────────────────────────────
  async verifyRoomBelongsToProperty(roomId: string, propertyId: string) {
    const room = await prisma.room.findFirst({
      where: { id: roomId, propertyId, deletedAt: null },
    });

    if (!room) {
      throw new AppError(
        'Kamar tidak ditemukan di properti ini',
        404,
        'ROOM_NOT_FOUND',
      );
    }

    return room;
  }
}

export const roomsService = new RoomsService();