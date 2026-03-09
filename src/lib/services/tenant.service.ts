// =============================================================================
// Tenant Service - Multi-tenancy management
// =============================================================================

import { db } from '@/lib/db';
import { PLAN_CONFIG, type PlanKey } from '@/lib/config/env';
import type { PlanTier, TenantStatus } from '@prisma/client';

export class TenantService {
  static async create(data: {
    name: string;
    slug: string;
    website?: string;
    description?: string;
    industry?: string;
    ownerEmail: string;
    ownerName: string;
    ownerPasswordHash: string;
    plan?: PlanTier;
  }) {
    const planKey = (data.plan || 'STARTER') as PlanKey;
    const planConfig = PLAN_CONFIG[planKey];

    return db.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: data.name,
          slug: data.slug,
          website: data.website,
          description: data.description,
          industry: data.industry,
          plan: planKey,
          status: 'TRIAL',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
          monthlyMinutes: planConfig.monthlyMinutes,
          maxReceptionists: planConfig.maxReceptionists,
          maxPhoneNumbers: planConfig.maxPhoneNumbers,
          maxKnowledgeSources: planConfig.maxKnowledgeSources,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: data.ownerEmail,
          name: data.ownerName,
          passwordHash: data.ownerPasswordHash,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });

      // Create default business hours (Mon-Fri 9-5)
      const defaultHours = [
        { dayOfWeek: 0, openTime: '09:00', closeTime: '17:00', isOpen: false }, // Sunday
        { dayOfWeek: 1, openTime: '09:00', closeTime: '17:00', isOpen: true },
        { dayOfWeek: 2, openTime: '09:00', closeTime: '17:00', isOpen: true },
        { dayOfWeek: 3, openTime: '09:00', closeTime: '17:00', isOpen: true },
        { dayOfWeek: 4, openTime: '09:00', closeTime: '17:00', isOpen: true },
        { dayOfWeek: 5, openTime: '09:00', closeTime: '17:00', isOpen: true },
        { dayOfWeek: 6, openTime: '09:00', closeTime: '17:00', isOpen: false }, // Saturday
      ];

      await tx.businessHour.createMany({
        data: defaultHours.map((h) => ({ ...h, tenantId: tenant.id })),
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          action: 'tenant.created',
          resource: 'tenant',
          resourceId: tenant.id,
          details: { plan: planKey, trialDays: 14 },
        },
      });

      return { tenant, user };
    });
  }

  static async getById(tenantId: string) {
    return db.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: {
            users: true,
            aiReceptionists: true,
            phoneNumbers: true,
            calls: true,
          },
        },
      },
    });
  }

  static async getBySlug(slug: string) {
    return db.tenant.findUnique({
      where: { slug },
    });
  }

  static async update(tenantId: string, data: {
    name?: string;
    website?: string;
    description?: string;
    logoUrl?: string;
    industry?: string;
    timezone?: string;
    defaultLanguage?: string;
  }) {
    return db.tenant.update({
      where: { id: tenantId },
      data,
    });
  }

  static async updatePlan(tenantId: string, plan: PlanTier) {
    const planConfig = PLAN_CONFIG[plan as PlanKey];
    return db.tenant.update({
      where: { id: tenantId },
      data: {
        plan,
        monthlyMinutes: planConfig.monthlyMinutes,
        maxReceptionists: planConfig.maxReceptionists,
        maxPhoneNumbers: planConfig.maxPhoneNumbers,
        maxKnowledgeSources: planConfig.maxKnowledgeSources,
      },
    });
  }

  static async updateStatus(tenantId: string, status: TenantStatus) {
    return db.tenant.update({
      where: { id: tenantId },
      data: { status },
    });
  }

  static async checkLimits(tenantId: string) {
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: {
            aiReceptionists: true,
            phoneNumbers: true,
            knowledgeSources: true,
          },
        },
      },
    });

    if (!tenant) throw new Error('Tenant not found');

    return {
      receptionists: {
        current: tenant._count.aiReceptionists,
        max: tenant.maxReceptionists,
        remaining: tenant.maxReceptionists - tenant._count.aiReceptionists,
      },
      phoneNumbers: {
        current: tenant._count.phoneNumbers,
        max: tenant.maxPhoneNumbers,
        remaining: tenant.maxPhoneNumbers - tenant._count.phoneNumbers,
      },
      knowledgeSources: {
        current: tenant._count.knowledgeSources,
        max: tenant.maxKnowledgeSources,
        remaining: tenant.maxKnowledgeSources - tenant._count.knowledgeSources,
      },
    };
  }

  static async isActive(tenantId: string): Promise<boolean> {
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true, trialEndsAt: true },
    });

    if (!tenant) return false;
    if (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED') return false;
    if (tenant.status === 'TRIAL' && tenant.trialEndsAt && tenant.trialEndsAt < new Date()) return false;

    return true;
  }

  static async delete(tenantId: string) {
    // GDPR-compliant deletion - cascades via schema
    return db.tenant.delete({ where: { id: tenantId } });
  }
}
