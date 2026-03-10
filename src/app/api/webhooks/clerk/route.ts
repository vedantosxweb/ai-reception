// =============================================================================
// Clerk Webhook - Sync new users to database
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { PLAN_CONFIG } from '@/lib/config/env';

// Clerk webhook event types we handle
interface ClerkUserEvent {
  data: {
    id: string;
    email_addresses: Array<{
      id: string;
      email_address: string;
    }>;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    created_at: number;
    updated_at: number;
  };
  type: string;
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  // If no webhook secret configured, still process but skip verification
  // (useful for development/testing)
  const body = await req.text();

  if (webhookSecret) {
    // Verify the webhook signature using Svix
    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
    }

    try {
      const wh = new Webhook(webhookSecret);
      wh.verify(body, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
    } catch (err) {
      log.webhook.error({ error: err }, 'Clerk webhook signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let event: ClerkUserEvent;
  try {
    event = JSON.parse(body) as ClerkUserEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = event.type;

  if (eventType === 'user.created') {
    const { id: clerkUserId, email_addresses, first_name, last_name } = event.data;
    const email = email_addresses?.[0]?.email_address;
    const name = [first_name, last_name].filter(Boolean).join(' ') || 'User';

    if (!email) {
      log.webhook.error({ clerkUserId }, 'Clerk user has no email address');
      return NextResponse.json({ error: 'No email address' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await db.user.findFirst({ where: { email } });
    if (existingUser) {
      log.webhook.info({ email, clerkUserId }, 'User already exists in database, skipping creation');
      return NextResponse.json({ message: 'User already exists' }, { status: 200 });
    }

    try {
      // Create tenant + user in a transaction
      const planConfig = PLAN_CONFIG['STARTER'];
      const companyName = name + "'s Company";
      const baseSlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      let slug = baseSlug.slice(0, 50) || 'company';
      let counter = 0;
      while (await db.tenant.findUnique({ where: { slug } })) {
        counter++;
        slug = `${baseSlug.slice(0, 46)}-${counter}`;
      }

      const result = await db.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: companyName,
            slug,
            plan: 'STARTER',
            status: 'TRIAL',
            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            monthlyMinutes: planConfig.monthlyMinutes,
            maxReceptionists: planConfig.maxReceptionists,
            maxPhoneNumbers: planConfig.maxPhoneNumbers,
            maxKnowledgeSources: planConfig.maxKnowledgeSources,
          },
        });

        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            email,
            name,
            passwordHash: '', // No password needed — Clerk handles auth
            role: 'OWNER',
            status: 'ACTIVE',
          },
        });

        // Create default business hours (Mon-Fri 9-5)
        const defaultHours = [
          { dayOfWeek: 0, openTime: '09:00', closeTime: '17:00', isOpen: false },
          { dayOfWeek: 1, openTime: '09:00', closeTime: '17:00', isOpen: true },
          { dayOfWeek: 2, openTime: '09:00', closeTime: '17:00', isOpen: true },
          { dayOfWeek: 3, openTime: '09:00', closeTime: '17:00', isOpen: true },
          { dayOfWeek: 4, openTime: '09:00', closeTime: '17:00', isOpen: true },
          { dayOfWeek: 5, openTime: '09:00', closeTime: '17:00', isOpen: true },
          { dayOfWeek: 6, openTime: '09:00', closeTime: '17:00', isOpen: false },
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
            details: { plan: 'STARTER', trialDays: 14, source: 'clerk_webhook' },
          },
        });

        return { tenant, user };
      });

      log.webhook.info(
        { email, clerkUserId, tenantId: result.tenant.id, userId: result.user.id },
        'New user registered via Clerk — tenant and user created'
      );

      return NextResponse.json({
        success: true,
        userId: result.user.id,
        tenantId: result.tenant.id,
      }, { status: 201 });
    } catch (err) {
      log.webhook.error({ error: err, email, clerkUserId }, 'Failed to create user from Clerk webhook');
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
  }

  if (eventType === 'user.updated') {
    const { email_addresses, first_name, last_name } = event.data;
    const email = email_addresses?.[0]?.email_address;
    const name = [first_name, last_name].filter(Boolean).join(' ');

    if (email && name) {
      await db.user.updateMany({
        where: { email },
        data: { name },
      });
      log.webhook.info({ email }, 'User profile updated from Clerk');
    }

    return NextResponse.json({ success: true });
  }

  if (eventType === 'user.deleted') {
    const { id: clerkUserId, email_addresses } = event.data;
    const email = email_addresses?.[0]?.email_address;

    if (email) {
      const user = await db.user.findFirst({
        where: { email },
        select: { id: true, tenantId: true },
      });

      if (user) {
        // Soft delete — mark user as inactive
        await db.user.update({
          where: { id: user.id },
          data: { status: 'INACTIVE' },
        });
        log.webhook.info({ email, clerkUserId }, 'User deactivated from Clerk deletion');
      }
    }

    return NextResponse.json({ success: true });
  }

  // Unhandled event type — acknowledge it
  return NextResponse.json({ received: true });
}
