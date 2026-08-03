import { prisma } from '../../config/database';
import { sendEmail } from '../../config/email';
import { hashPassword } from '../../utils/hash';
import { generateTemporaryPassword } from '../../utils/passwordGenerator';
import { AppError } from '../../middleware/errorHandler';
import { getPagination, getPaginationMeta } from '../../utils/pagination';
import { welcomeTenantTemplate } from '../../utils/emailTemplates';
import type { CreateTenantInput, UpdateTenantInput, TenantQueryInput } from './tenants.schema';

// ── Helper: normalize tenant ke snake_case ────────────────────────
function normalizeTenant(t: {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string | null;
  idCardNumber?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  isActive?: boolean;
  createdAt: Date;
  active_contract?: {
    id: string;
    room: { roomNumber: string; property: { name: string } };
  } | null;
  contracts?: Array<{
    id: string;
    startDate: Date;
    endDate: Date;
    monthlyRent: unknown;
    status: string;
    room: { roomNumber: string; property: { name: string } };
  }>;
}) {
  return {
    id: t.id,
    email: t.email,
    full_name: t.fullName,
    phone_number: t.phoneNumber ?? null,
    id_card_number: t.idCardNumber ?? null,
    emergency_contact_name: t.emergencyContactName ?? null,
    emergency_contact_phone: t.emergencyContactPhone ?? null,
    is_active: t.isActive ?? true,
    created_at: t.createdAt,
    ...(t.active_contract !== undefined && {
      active_contract: t.active_contract
        ? {
            id: t.active_contract.id,
            room: {
              room_number: t.active_contract.room.roomNumber,
              property: { name: t.active_contract.room.property.name },
            },
          }
        : null,
    }),
    ...(t.contracts && {
      contracts: t.contracts.map((c) => ({
        id: c.id,
        start_date: c.startDate,
        end_date: c.endDate,
        monthly_rent: Number(c.monthlyRent),
        status: c.status,
        room: {
          room_number: c.room.roomNumber,
          property: { name: c.room.property.name },
        },
      })),
    }),
  };
}

export class TenantsService {
  // ------------------------------------------------
  // CREATE TENANT (didaftarkan owner)
  // ------------------------------------------------
  async createTenant(ownerId: string, input: CreateTenantInput) {
    const existingTenant = await prisma.tenant.findUnique({ where: { email: input.email } });
    if (existingTenant) {
      throw new AppError('Email penghuni sudah terdaftar di sistem', 409, 'TENANT_EMAIL_ALREADY_EXISTS');
    }

    const tempPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(tempPassword);

    const tenant = await prisma.tenant.create({
      data: {
        email: input.email,
        passwordHash,
        fullName: input.full_name,
        phoneNumber: input.phone_number,
        idCardNumber: input.id_card_number,
        emergencyContactName: input.emergency_contact_name,
        emergencyContactPhone: input.emergency_contact_phone,
        createdByOwnerId: ownerId, // tandai siapa yang membuat
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'tenant',
        entityId: tenant.id,
        action: 'CREATED',
        newValues: { email: tenant.email, fullName: tenant.fullName },
        performedBy: ownerId,
        performerRole: 'owner',
      },
    });

    const template = welcomeTenantTemplate({
      fullName: tenant.fullName,
      email: tenant.email,
      tempPassword,
      propertyName: '-',
      roomNumber: '-',
    });

    await sendEmail({ to: tenant.email, subject: template.subject, html: template.html });

    return normalizeTenant(tenant);
  }

  // ------------------------------------------------
  // GET ALL TENANTS — semua tenant yang pernah dibuat owner ini
  // ATAU pernah/sedang berkontrak dengan owner ini (semua status)
  // ------------------------------------------------
  async getTenants(ownerId: string, query: TenantQueryInput) {
    const { skip, take, page, limit } = getPagination(query);

    // Tenant yang dibuat oleh owner ini
    const createdByOwner = await prisma.tenant.findMany({
      where: { createdByOwnerId: ownerId, deletedAt: null },
      select: { id: true },
    });

    // Tenant yang pernah berkontrak dengan owner ini (ANY status — ACTIVE, TERMINATED, EXPIRED, dll)
    // TIDAK filter by status agar penghuni lama tetap muncul
    const contractFilter: Record<string, unknown> = { ownerId };
    if (query.property_id) contractFilter.room = { propertyId: query.property_id };
    // Khusus filter 'active' hanya untuk keperluan filter UI, bukan untuk tenant dropdown
    if (query.status === 'active') contractFilter.status = 'ACTIVE';

    const fromContracts = await prisma.contract.findMany({
      where: contractFilter,
      select: { tenantId: true },
      distinct: ['tenantId'],
    });

    // Gabungkan, deduplicate
    const allIds = [
      ...new Set([
        ...createdByOwner.map((t) => t.id),
        ...fromContracts.map((c) => c.tenantId),
      ]),
    ];

    // Jika tidak ada sama sekali, return kosong
    if (allIds.length === 0) {
      return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
    }

    const where = {
      id: { in: allIds },
      deletedAt: null,
      ...(query.search && {
        OR: [
          { fullName: { contains: query.search, mode: 'insensitive' as const } },
          { email: { contains: query.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.tenant.count({ where }),
    ]);

    // Ambil info kontrak aktif untuk tiap tenant
    const tenantsWithContract = await Promise.all(
      tenants.map(async (tenant) => {
        const activeContract = await prisma.contract.findFirst({
          where: { tenantId: tenant.id, ownerId, status: 'ACTIVE' },
          select: {
            id: true,
            room: {
              select: {
                roomNumber: true,
                property: { select: { name: true } },
              },
            },
          },
        });
        return normalizeTenant({ ...tenant, active_contract: activeContract });
      }),
    );

    return {
      data: tenantsWithContract,
      meta: getPaginationMeta(total, page, limit),
    };
  }

  // ------------------------------------------------
  // GET TENANT DETAIL
  // ------------------------------------------------
  async getTenantById(tenantId: string, ownerId: string) {
    await this.verifyTenantRelationToOwner(tenantId, ownerId);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
    });

    if (!tenant) throw new AppError('Penghuni tidak ditemukan', 404, 'TENANT_NOT_FOUND');

    const contracts = await prisma.contract.findMany({
      where: { tenantId, ownerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        monthlyRent: true,
        status: true,
        room: {
          select: {
            roomNumber: true,
            property: { select: { name: true } },
          },
        },
      },
    });

    return normalizeTenant({ ...tenant, contracts });
  }

  // ------------------------------------------------
  // UPDATE TENANT
  // ------------------------------------------------
  async updateTenant(tenantId: string, ownerId: string, input: UpdateTenantInput) {
    await this.verifyTenantRelationToOwner(tenantId, ownerId);

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(input.full_name && { fullName: input.full_name }),
        ...(input.phone_number !== undefined && { phoneNumber: input.phone_number }),
        ...(input.id_card_number !== undefined && { idCardNumber: input.id_card_number }),
        ...(input.emergency_contact_name !== undefined && {
          emergencyContactName: input.emergency_contact_name,
        }),
        ...(input.emergency_contact_phone !== undefined && {
          emergencyContactPhone: input.emergency_contact_phone,
        }),
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'tenant',
        entityId: tenantId,
        action: 'UPDATED',
        newValues: input,
        performedBy: ownerId,
        performerRole: 'owner',
      },
    });

    return normalizeTenant(updated);
  }

  // ------------------------------------------------
  // HELPER: Verifikasi tenant punya relasi dengan owner
  // ------------------------------------------------
  async verifyTenantRelationToOwner(tenantId: string, ownerId: string) {
    const relation = await prisma.contract.findFirst({
      where: { tenantId, ownerId },
    });

    if (!relation) {
      throw new AppError(
        'Penghuni tidak ditemukan atau tidak terkait dengan propertimu',
        404,
        'TENANT_NOT_FOUND',
      );
    }
  }
}

export const tenantsService = new TenantsService();
