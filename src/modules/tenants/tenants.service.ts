import { prisma } from '../../config/database';
import { sendEmail } from '../../config/email';
import { hashPassword } from '../../utils/hash';
import { generateTemporaryPassword } from '../../utils/passwordGenerator';
import { AppError } from '../../middleware/errorHandler';
import { getPagination, getPaginationMeta } from '../../utils/pagination';
import { welcomeTenantTemplate } from '../../utils/emailTemplates';
import type {
  CreateTenantInput,
  UpdateTenantInput,
  TenantQueryInput,
} from './tenants.schema';

export class TenantsService {

  // ────────────────────────────────────────────────
  // CREATE TENANT (didaftarkan owner)
  // ────────────────────────────────────────────────
  async createTenant(ownerId: string, input: CreateTenantInput) {
    const existingTenant = await prisma.tenant.findUnique({
      where: { email: input.email },
    });

    if (existingTenant) {
      throw new AppError(
        'Email penghuni sudah terdaftar di sistem',
        409,
        'TENANT_EMAIL_ALREADY_EXISTS',
      );
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
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        createdAt: true,
      },
    });

    // Catat audit log
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

    // Kirim email berisi kredensial — TANPA info kamar dulu,
    // karena tenant belum tentu langsung punya kontrak
    const template = welcomeTenantTemplate({
      fullName: tenant.fullName,
      email: tenant.email,
      tempPassword,
      propertyName: '-',
      roomNumber: '-',
    });

    await sendEmail({
      to: tenant.email,
      subject: template.subject,
      html: template.html,
    });

    return tenant;
  }

  // ────────────────────────────────────────────────
  // GET ALL TENANTS (yang pernah/sedang menghuni properti owner)
  // ────────────────────────────────────────────────
  async getTenants(ownerId: string, query: TenantQueryInput) {
    const { skip, take, page, limit } = getPagination(query);

    // Ambil tenant_id yang pernah punya kontrak dengan owner ini
    const contractFilter: Record<string, unknown> = { ownerId };
    if (query.property_id) {
      contractFilter.room = { propertyId: query.property_id };
    }
    if (query.status === 'active') {
      contractFilter.status = 'ACTIVE';
    }

    const relevantTenantIds = await prisma.contract.findMany({
      where: contractFilter,
      select: { tenantId: true },
      distinct: ['tenantId'],
    });

    const tenantIds = relevantTenantIds.map((c) => c.tenantId);

    const where = {
      id: { in: tenantIds },
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
        select: {
          id: true,
          email: true,
          fullName: true,
          phoneNumber: true,
          createdAt: true,
        },
      }),
      prisma.tenant.count({ where }),
    ]);

    // Tambahkan info kontrak aktif untuk tiap tenant
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
        return { ...tenant, active_contract: activeContract };
      }),
    );

    return {
      data: tenantsWithContract,
      meta: getPaginationMeta(total, page, limit),
    };
  }

  // ────────────────────────────────────────────────
  // GET TENANT DETAIL
  // ────────────────────────────────────────────────
  async getTenantById(tenantId: string, ownerId: string) {
    await this.verifyTenantRelationToOwner(tenantId, ownerId);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        idCardNumber: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        createdAt: true,
      },
    });

    if (!tenant) {
      throw new AppError('Penghuni tidak ditemukan', 404, 'TENANT_NOT_FOUND');
    }

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

    return { ...tenant, contracts };
  }

  // ────────────────────────────────────────────────
  // UPDATE TENANT
  // ────────────────────────────────────────────────
  async updateTenant(
    tenantId: string,
    ownerId: string,
    input: UpdateTenantInput,
  ) {
    await this.verifyTenantRelationToOwner(tenantId, ownerId);

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(input.full_name && { fullName: input.full_name }),
        ...(input.phone_number && { phoneNumber: input.phone_number }),
        ...(input.id_card_number && { idCardNumber: input.id_card_number }),
        ...(input.emergency_contact_name && {
          emergencyContactName: input.emergency_contact_name,
        }),
        ...(input.emergency_contact_phone && {
          emergencyContactPhone: input.emergency_contact_phone,
        }),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
      },
    });

    return updated;
  }

  // ────────────────────────────────────────────────
  // HELPER: Verifikasi tenant punya relasi dengan owner
  // ────────────────────────────────────────────────
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