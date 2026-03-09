// =============================================================================
// Integrations API - CRUD for HubSpot, Google Calendar connections
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/api-auth';
import { Prisma } from '@prisma/client';
import {
  integrationConnectSchema,
  integrationUpdateSchema,
  validateRequest,
} from '@/lib/security/validation';
import { serializeIntegrationCredentials } from '@/lib/security/integration-credentials';

const VALID_PROVIDERS = ['hubspot', 'google_calendar'] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

// GET: List all integrations for the tenant
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const tenantId = session.user.tenantId;

  const integrations = await db.integration.findMany({
    where: { tenantId },
    select: {
      id: true,
      provider: true,
      status: true,
      config: true,
      lastSyncAt: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ success: true, data: integrations });
}

// POST: Connect a new integration
export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const tenantId = session.user.tenantId;
  const body = await req.json();
  const parsed = validateRequest(integrationConnectSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
  }
  const { provider, credentials, config } = parsed.data;

  // Validate credentials based on provider
  if (provider === 'hubspot' && !credentials.accessToken) {
    return NextResponse.json(
      { success: false, error: 'HubSpot requires an accessToken' },
      { status: 400 }
    );
  }
  if (provider === 'google_calendar') {
    if (!credentials.clientId || !credentials.clientSecret || !credentials.refreshToken) {
      return NextResponse.json(
        { success: false, error: 'Google Calendar requires clientId, clientSecret, and refreshToken' },
        { status: 400 }
      );
    }
  }

  // Test connection before saving
  if (provider === 'hubspot') {
    try {
      const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      });
      if (!res.ok) {
        return NextResponse.json(
          { success: false, error: `HubSpot connection failed: ${res.status} ${res.statusText}` },
          { status: 400 }
        );
      }
    } catch (err) {
      return NextResponse.json(
        { success: false, error: `HubSpot connection test failed: ${(err as Error).message}` },
        { status: 400 }
      );
    }
  }

  // Upsert integration
  const integration = await db.integration.upsert({
    where: { tenantId_provider: { tenantId, provider } },
    create: {
      tenantId,
      provider,
      status: 'active',
      credentials: serializeIntegrationCredentials(credentials),
      config: (config || {}) as unknown as Prisma.InputJsonValue,
    },
    update: {
      status: 'active',
      credentials: serializeIntegrationCredentials(credentials),
      config: (config || {}) as unknown as Prisma.InputJsonValue,
      errorMessage: null,
    },
  });

  // If Google Calendar, save the calendarId in tenant
  if (provider === 'google_calendar' && config?.calendarId) {
    await db.tenant.update({
      where: { id: tenantId },
      data: { googleCalendarId: config.calendarId as string },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      id: integration.id,
      provider: integration.provider,
      status: integration.status,
      createdAt: integration.createdAt,
    },
  });
}

// PATCH: Update integration config/status
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const tenantId = session.user.tenantId;
  const body = await req.json();
  const parsed = validateRequest(integrationUpdateSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
  }
  const { provider, status, config, credentials } = parsed.data;

  const existing = await db.integration.findUnique({
    where: { tenantId_provider: { tenantId, provider } },
  });

  if (!existing) {
    return NextResponse.json(
      { success: false, error: 'Integration not found' },
      { status: 404 }
    );
  }

  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = status;
  if (config) updateData.config = config as unknown as Prisma.InputJsonValue;
  if (credentials) updateData.credentials = serializeIntegrationCredentials(credentials);

  const updated = await db.integration.update({
    where: { tenantId_provider: { tenantId, provider } },
    data: updateData,
  });

  return NextResponse.json({
    success: true,
    data: {
      id: updated.id,
      provider: updated.provider,
      status: updated.status,
    },
  });
}

// DELETE: Disconnect an integration
export async function DELETE(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider');

  if (!provider) {
    return NextResponse.json(
      { success: false, error: 'Provider query param is required' },
      { status: 400 }
    );
  }

  const existing = await db.integration.findUnique({
    where: { tenantId_provider: { tenantId, provider } },
  });

  if (!existing) {
    return NextResponse.json(
      { success: false, error: 'Integration not found' },
      { status: 404 }
    );
  }

  await db.integration.delete({
    where: { tenantId_provider: { tenantId, provider } },
  });

  // Clear Google Calendar ID from tenant if disconnecting
  if (provider === 'google_calendar') {
    await db.tenant.update({
      where: { id: tenantId },
      data: { googleCalendarId: null },
    });
  }

  return NextResponse.json({ success: true, message: `${provider} integration disconnected` });
}
