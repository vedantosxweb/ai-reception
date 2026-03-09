// =============================================================================
// Knowledge Base API
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession, requireOwnerOrAdmin } from '@/lib/api-auth';
import { KnowledgeBaseService } from '@/lib/knowledge/knowledge.service';

// GET /api/v1/knowledge - List knowledge sources
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const sources = await db.knowledgeSource.findMany({
    where: { tenantId: session.user.tenantId },
    include: { _count: { select: { embeddings: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: sources });
}

// POST /api/v1/knowledge - Add knowledge source
export async function POST(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { type, receptionistId, name, content, url, faqs } = body;

    if (!type || !receptionistId) {
      return NextResponse.json(
        { success: false, error: 'Type and receptionistId are required' },
        { status: 400 }
      );
    }

    // Verify receptionist belongs to tenant
    const receptionist = await db.aIReceptionist.findFirst({
      where: { id: receptionistId, tenantId: session.user.tenantId },
    });

    if (!receptionist) {
      return NextResponse.json({ success: false, error: 'Receptionist not found' }, { status: 404 });
    }

    let sourceId: string;

    switch (type) {
      case 'website':
        if (!url) return NextResponse.json({ success: false, error: 'URL required for website type' }, { status: 400 });
        sourceId = await KnowledgeBaseService.addWebsiteSource(session.user.tenantId, receptionistId, url);
        break;
      case 'faq':
        if (!faqs || !Array.isArray(faqs)) return NextResponse.json({ success: false, error: 'FAQs required' }, { status: 400 });
        sourceId = await KnowledgeBaseService.addFAQSource(session.user.tenantId, receptionistId, faqs);
        break;
      case 'text':
        if (!content) return NextResponse.json({ success: false, error: 'Content required for text type' }, { status: 400 });
        sourceId = await KnowledgeBaseService.addTextSource(session.user.tenantId, receptionistId, name || 'Text Source', content);
        break;
      default:
        return NextResponse.json({ success: false, error: 'Invalid type. Must be website, faq, or text' }, { status: 400 });
    }

    const source = await db.knowledgeSource.findUnique({ where: { id: sourceId } });

    return NextResponse.json({ success: true, data: source }, { status: 201 });
  } catch (err) {
    console.error('[Knowledge] Create error:', err);
    return NextResponse.json({ success: false, error: 'Failed to add knowledge source' }, { status: 500 });
  }
}

// DELETE /api/v1/knowledge
export async function DELETE(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, error: 'Source ID required' }, { status: 400 });
  }

  const source = await db.knowledgeSource.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });

  if (!source) {
    return NextResponse.json({ success: false, error: 'Source not found' }, { status: 404 });
  }

  await KnowledgeBaseService.deleteSource(id, session.user.tenantId);

  return NextResponse.json({ success: true, message: 'Knowledge source deleted' });
}
