import { prisma } from '../../config/database';
import { sendEmail } from '../../config/email';
import { AppError } from '../../middleware/errorHandler';
import { getPagination, getPaginationMeta } from '../../utils/pagination';
import { COMPLAINT_STATUS_ORDER } from './complaints.schema';
import type {
  CreateComplaintInput,
  UpdateComplaintStatusInput,
  AddResponseInput,
  ComplaintQueryInput,
} from './complaints.schema';

export class ComplaintsService {

  // ────────────────────────────────────────────────
  // CREATE COMPLAINT (tenant only)
  // ────────────────────────────────────────────────
  async createComplaint(tenantId: string, input: CreateComplaintInput) {
    // Verifikasi tenant punya kontrak aktif di kamar ini
    const activeContract = await prisma.contract.findFirst({
      where: { tenantId, roomId: input.room_id, status: 'ACTIVE' },
      include: {
        room: {
          include: { property: { select: { id: true, name: true, ownerId: true } } },
        },
      },
    });

    if (!activeContract) {
      throw new AppError(
        'Kamu tidak memiliki kontrak aktif di kamar ini',
        403,
        'COMPLAINT_NO_ACTIVE_CONTRACT',
      );
    }

    const complaint = await prisma.complaint.create({
      data: {
        tenantId,
        propertyId: activeContract.room.property.id,
        roomId: input.room_id,
        title: input.title,
        description: input.description,
        category: input.category,
        priority: input.priority,
        photos: input.photos,
        status: 'OPEN',
      },
      include: {
        tenant: { select: { fullName: true } },
        room: { select: { roomNumber: true } },
      },
    });

    // Kirim notifikasi ke owner
    const owner = await prisma.owner.findUnique({
      where: { id: activeContract.room.property.ownerId },
      select: { email: true, fullName: true },
    });

    if (owner) {
      await sendEmail({
        to: owner.email,
        subject: `Komplain Baru: ${input.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h2>Komplain Baru Masuk</h2>
            <p>Halo ${owner.fullName},</p>
            <p>Penghuni <strong>${complaint.tenant.fullName}</strong> dari kamar 
               <strong>${complaint.room.roomNumber}</strong> mengajukan komplain baru.</p>
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p><strong>Judul:</strong> ${input.title}</p>
              <p><strong>Kategori:</strong> ${input.category}</p>
              <p><strong>Prioritas:</strong> ${input.priority}</p>
              <p><strong>Deskripsi:</strong> ${input.description}</p>
            </div>
          </div>
        `,
      }).catch((err) => {
        console.error('Gagal mengirim notifikasi komplain ke owner:', err);
      });
    }

    return complaint;
  }

  // ────────────────────────────────────────────────
  // GET COMPLAINTS (akses berbeda owner vs tenant)
  // ────────────────────────────────────────────────
  async getComplaints(
    userId: string,
    role: 'owner' | 'tenant',
    query: ComplaintQueryInput,
  ) {
    const { skip, take, page, limit } = getPagination(query);

    const where = {
      ...(role === 'owner' && { property: { ownerId: userId } }),
      ...(role === 'tenant' && { tenantId: userId }),
      ...(query.property_id && { propertyId: query.property_id }),
      ...(query.status && { status: query.status }),
      ...(query.category && { category: query.category }),
      ...(query.priority && { priority: query.priority }),
    };

    const [complaints, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        skip,
        take,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        include: {
          tenant: { select: { fullName: true } },
          room: { select: { roomNumber: true } },
          property: { select: { name: true } },
          _count: { select: { responses: true } },
        },
      }),
      prisma.complaint.count({ where }),
    ]);

    return {
      data: complaints,
      meta: getPaginationMeta(total, page, limit),
    };
  }

  // ────────────────────────────────────────────────
  // GET COMPLAINT DETAIL
  // ────────────────────────────────────────────────
  async getComplaintById(
    complaintId: string,
    userId: string,
    role: 'owner' | 'tenant',
  ) {
    const complaint = await prisma.complaint.findFirst({
      where: {
        id: complaintId,
        ...(role === 'owner' && { property: { ownerId: userId } }),
        ...(role === 'tenant' && { tenantId: userId }),
      },
      include: {
        tenant: { select: { id: true, fullName: true, phoneNumber: true } },
        room: { select: { roomNumber: true } },
        property: { select: { name: true, ownerId: true } },
        responses: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!complaint) {
      throw new AppError('Komplain tidak ditemukan', 404, 'COMPLAINT_NOT_FOUND');
    }

    return complaint;
  }

  // ────────────────────────────────────────────────
  // UPDATE STATUS (state machine, owner only)
  // ────────────────────────────────────────────────
  async updateStatus(
    complaintId: string,
    ownerId: string,
    input: UpdateComplaintStatusInput,
  ) {
    const complaint = await prisma.complaint.findFirst({
      where: { id: complaintId, property: { ownerId } },
      include: { tenant: { select: { fullName: true, email: true } } },
    });

    if (!complaint) {
      throw new AppError('Komplain tidak ditemukan', 404, 'COMPLAINT_NOT_FOUND');
    }

    const currentIndex = COMPLAINT_STATUS_ORDER.indexOf(
      complaint.status as typeof COMPLAINT_STATUS_ORDER[number],
    );
    const newIndex = COMPLAINT_STATUS_ORDER.indexOf(input.status);

    if (newIndex < currentIndex) {
      throw new AppError(
        `Status tidak bisa mundur dari ${complaint.status} ke ${input.status}`,
        422,
        'COMPLAINT_STATUS_CANNOT_REGRESS',
      );
    }

    if (newIndex === currentIndex) {
      throw new AppError(
        `Komplain sudah berstatus ${input.status}`,
        409,
        'COMPLAINT_STATUS_UNCHANGED',
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.complaint.update({
        where: { id: complaintId },
        data: {
          status: input.status,
          ...(input.status === 'RESOLVED' && { resolvedAt: new Date() }),
        },
      });

      // Kalau ada catatan, simpan sebagai response otomatis dari owner
      if (input.note) {
        await tx.complaintResponse.create({
          data: {
            complaintId,
            responderId: ownerId,
            responderRole: 'owner',
            message: input.note,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: 'complaint',
          entityId: complaintId,
          action: 'STATUS_CHANGED',
          oldValues: { status: complaint.status },
          newValues: { status: input.status, note: input.note },
          performedBy: ownerId,
          performerRole: 'owner',
        },
      });

      return result;
    });

    // Notifikasi ke tenant
    await sendEmail({
      to: complaint.tenant.email,
      subject: `Update Status Komplain: ${complaint.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2>Status Komplain Diperbarui</h2>
          <p>Halo ${complaint.tenant.fullName},</p>
          <p>Status komplain kamu <strong>"${complaint.title}"</strong> telah diperbarui menjadi 
             <strong>${input.status}</strong>.</p>
          ${input.note ? `<p><strong>Catatan dari pemilik:</strong> ${input.note}</p>` : ''}
        </div>
      `,
    }).catch((err) => {
      console.error('Gagal mengirim notifikasi update status komplain:', err);
    });

    return updated;
  }

  // ────────────────────────────────────────────────
  // ADD RESPONSE (owner atau tenant pemilik komplain)
  // ────────────────────────────────────────────────
  async addResponse(
    complaintId: string,
    userId: string,
    role: 'owner' | 'tenant',
    input: AddResponseInput,
  ) {
    const complaint = await prisma.complaint.findFirst({
      where: {
        id: complaintId,
        ...(role === 'owner' && { property: { ownerId: userId } }),
        ...(role === 'tenant' && { tenantId: userId }),
      },
    });

    if (!complaint) {
      throw new AppError('Komplain tidak ditemukan', 404, 'COMPLAINT_NOT_FOUND');
    }

    if (complaint.status === 'CLOSED') {
      throw new AppError(
        'Tidak bisa membalas komplain yang sudah ditutup',
        409,
        'COMPLAINT_ALREADY_CLOSED',
      );
    }

    const response = await prisma.complaintResponse.create({
      data: {
        complaintId,
        responderId: userId,
        responderRole: role,
        message: input.message,
      },
    });

    return response;
  }

  // ────────────────────────────────────────────────
  // GET COMPLAINTS SUMMARY (untuk dashboard ringkas)
  // ────────────────────────────────────────────────
  async getComplaintsSummary(ownerId: string, propertyId?: string) {
    const where = {
      property: { ownerId },
      ...(propertyId && { propertyId }),
    };

    const statusCounts = await prisma.complaint.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    });

    const categoryCounts = await prisma.complaint.groupBy({
      by: ['category'],
      where,
      _count: { category: true },
    });

    return {
      by_status: statusCounts.map((s) => ({
        status: s.status,
        count: s._count.status,
      })),
      by_category: categoryCounts.map((c) => ({
        category: c.category,
        count: c._count.category,
      })),
    };
  }
}

export const complaintsService = new ComplaintsService();