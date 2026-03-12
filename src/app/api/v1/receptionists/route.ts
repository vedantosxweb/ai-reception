// =============================================================================
// AI Receptionists API - CRUD + Setup Wizard
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { requireSession, requireOwnerOrAdmin } from '@/lib/api-auth';
import { TenantService } from '@/lib/services/tenant.service';
import {
  receptionistCreateSchema,
  receptionistUpdateSchema,
  validateRequest,
} from '@/lib/security/validation';

// GET /api/v1/receptionists - List receptionists for tenant
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const receptionists = await db.aIReceptionist.findMany({
    where: { tenantId: session.user.tenantId },
    include: {
      phoneNumbers: { select: { id: true, number: true, status: true } },
      _count: { select: { calls: true, knowledgeSources: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Fetch aggregate metrics for each receptionist
  const receptionistMetrics = await Promise.all(
    receptionists.map(async (r) => {
      const calls = await db.call.findMany({
        where: { receptionistId: r.id },
        select: { 
          status: true, 
          sentiment: true,
          _count: { select: { transfers: true } }
        },
      });

      const totalCalls = calls.length;
      if (totalCalls === 0) {
        return { ...r, metrics: { resolutionRate: 0, avgSentiment: 0, successRate: 0 } };
      }

      const completed = calls.filter(c => c.status === 'COMPLETED').length;
      const transferred = calls.filter(c => c._count.transfers > 0).length;
      const resolutionRate = Math.round(((completed - transferred) / totalCalls) * 100);
      
      const sentiments: number[] = calls.map(c => {
        if (c.sentiment === 'POSITIVE') return 1;
        if (c.sentiment === 'NEGATIVE') return 0;
        return 0.5;
      });
      const avgSentiment = Math.round((sentiments.reduce((a, b) => a + b, 0) / totalCalls) * 100);
      const successRate = Math.round((completed / totalCalls) * 100);

      return {
        ...r,
        metrics: {
          resolutionRate: Math.max(0, resolutionRate),
          avgSentiment,
          successRate
        }
      };
    })
  );

  return NextResponse.json({ success: true, data: receptionistMetrics });
}

// POST /api/v1/receptionists - Create new receptionist
export async function POST(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  const tenantId = session.user.tenantId;

  // Check plan limits
  const limits = await TenantService.checkLimits(tenantId);
  if (limits.receptionists.remaining <= 0) {
    return NextResponse.json(
      { success: false, error: 'Receptionist limit reached. Please upgrade your plan.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = validateRequest(receptionistCreateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }
    const {
      name,
      description,
      voiceProvider,
      voiceId,
      voiceLanguage,
      voiceSpeed,
      llmProvider,
      llmModel,
      temperature,
      maxTokens,
      sttProvider,
      greeting,
      systemPrompt,
      fallbackMessage,
      enableInterruptions,
      enableSmsFollowup,
      enableVoicemail,
      enableEmergencyDetect,
      neverSendToVoicemail,
      operatingMode,
      maxCallDuration,
      silenceTimeout,
    } = parsed.data;

    const receptionist = await db.aIReceptionist.create({
      data: {
        tenantId,
        name,
        description,
        status: 'DRAFT',
        voiceProvider: voiceProvider || 'openai',
        voiceId: voiceId || 'alloy',
        voiceLanguage: voiceLanguage || 'en',
        voiceSpeed: voiceSpeed ?? 1.0,
        llmProvider: llmProvider || 'openai',
        llmModel: llmModel || 'gpt-4o-mini',
        temperature: temperature ?? 0.7,
        maxTokens: maxTokens ?? 1024,
        sttProvider: sttProvider || 'deepgram',
        greeting: greeting || `Hello! Thank you for calling. How can I help you today?`,
        systemPrompt,
        fallbackMessage: fallbackMessage || "I apologize, I'm having trouble understanding. Let me transfer you to someone who can help.",
        enableInterruptions: enableInterruptions ?? true,
        enableSmsFollowup: enableSmsFollowup ?? true,
        enableVoicemail: enableVoicemail ?? true,
        enableEmergencyDetect: enableEmergencyDetect ?? true,
        neverSendToVoicemail: neverSendToVoicemail ?? false,
        operatingMode: operatingMode || 'standard',
        maxCallDuration: maxCallDuration ?? 600,
        silenceTimeout: silenceTimeout ?? 10,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        tenantId,
        userId: session.user.id,
        action: 'receptionist.created',
        resource: 'ai_receptionist',
        resourceId: receptionist.id,
        details: { name },
      },
    });

    return NextResponse.json({ success: true, data: receptionist }, { status: 201 });
  } catch (err) {
    log.api.error({ error: err }, 'Failed to create receptionist');
    return NextResponse.json({ success: false, error: 'Failed to create receptionist' }, { status: 500 });
  }
}

// PATCH /api/v1/receptionists - Update receptionist
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = validateRequest(receptionistUpdateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }
    const { id, ...updateData } = parsed.data;
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields provided to update' }, { status: 400 });
    }

    // Verify ownership
    const existing = await db.aIReceptionist.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Receptionist not found' }, { status: 404 });
    }

    const updated = await db.aIReceptionist.update({
      where: { id },
      data: updateData,
    });

    await db.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: 'receptionist.updated',
        resource: 'ai_receptionist',
        resourceId: id,
        details: { fields: Object.keys(updateData) },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    log.api.error({ error: err }, 'Failed to update receptionist');
    return NextResponse.json({ success: false, error: 'Failed to update receptionist' }, { status: 500 });
  }
}

// DELETE /api/v1/receptionists - Delete receptionist
export async function DELETE(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, error: 'Receptionist ID required' }, { status: 400 });
  }

  const existing = await db.aIReceptionist.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });

  if (!existing) {
    return NextResponse.json({ success: false, error: 'Receptionist not found' }, { status: 404 });
  }

  await db.aIReceptionist.delete({ where: { id } });

  await db.auditLog.create({
    data: {
      tenantId: session.user.tenantId,
      userId: session.user.id,
      action: 'receptionist.deleted',
      resource: 'ai_receptionist',
      resourceId: id,
    },
  });

  return NextResponse.json({ success: true, message: 'Receptionist deleted' });
}
